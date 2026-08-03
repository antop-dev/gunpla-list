package ai.antop.gunpla.productrelease.service

import io.github.oshai.kotlinlogging.KotlinLogging
import org.jsoup.Jsoup
import org.jsoup.nodes.Document
import org.springframework.http.HttpHeaders
import org.springframework.stereotype.Service
import java.math.BigDecimal
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse.BodyHandlers
import java.time.Duration
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.concurrent.Callable
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

private val log = KotlinLogging.logger {}

// global.bandai-hobby.net(반다이 하비 글로벌) 발매 스케줄 페이지에서 등급별 상품 목록을 수집
// 로케일별로 URL 접두어만 다른 별도 페이지(한국어/일본어/영어)를 제공하며,
// 상품 상세 링크에 포함된 id(예: item/01_7125/ 의 "01_7125")가 세 로케일에서 동일하게 유지되므로
// 이 id 를 키로 삼아 3개 로케일의 제품명을 병합한다
// 한국어 페이지가 제품명(nameKo)/출시가격/출시년월/이미지를 모두 제공하므로 기준(primary) 소스로 쓰고,
// 일본어/영어 페이지는 같은 id 로 제품명만 보조로 가져온다(사이트가 이미 다국어 지원이라 번역 불필요)
// 조회 대상 연월은 현재 연월 기준 -6개월 ~ +6개월, 제품명이 "MG"/"HG"/"RG"/"PG"로 시작하는 것만 등급으로 인정
@Service
class BandaiScheduleScraperService : ProductScraperService {
    override fun scrapeAll(): List<ScrapedProductRow> {
        val executor: ExecutorService = Executors.newFixedThreadPool(FETCH_CONCURRENCY)
        val rows =
            try {
                monthRange()
                    .map { month -> executor.submit(Callable { scrapeMonth(month) }) }
                    .flatMap { it.get() }
            } finally {
                executor.shutdown()
            }
        log.info { "bandai-hobby schedule: found ${rows.size} graded items across ${monthRange().size} months" }
        return rows
    }

    private fun monthRange(): List<String> {
        val thisMonth = LocalDate.now().withDayOfMonth(1)
        return (-MONTH_SPAN..MONTH_SPAN).map { offset -> thisMonth.plusMonths(offset.toLong()).format(MONTH_FORMAT) }
    }

    // 조회한 saledate 월(month, yyyyMM)로 페이지를 필터링해 가져오므로 해당 월 자체가 곧 출시년월 —
    // 카드 안의 날짜 텍스트는 레이아웃이 월마다 달라(가까운 미래는 카드별 텍스트, 지난 달은 일자별 헤딩) 신뢰할 수 없어 사용하지 않음
    private fun scrapeMonth(month: String): List<ScrapedProductRow> {
        val krCards = parseCards(fetchDoc("$KR_BASE/schedule/index.php?saledate=$month"))
        if (krCards.isEmpty()) return emptyList()
        val jpNames = parseCards(fetchDoc("$JP_BASE/schedule/index.php?saledate=$month")).associate { it.id to it.title }
        val enNames = parseCards(fetchDoc("$EN_BASE/schedule/index.php?saledate=$month")).associate { it.id to it.title }
        val dateText = "${month.substring(0, 4)}.${month.substring(4, 6).toInt()}"

        return krCards.mapNotNull { kr ->
            val grade = gradeOf(kr.title) ?: return@mapNotNull null
            ScrapedProductRow(
                grade = grade,
                source = SOURCE_NAME,
                nameKo = kr.title,
                nameEn = enNames[kr.id],
                nameJp = jpNames[kr.id],
                modelNumber = null,
                dateText = dateText,
                series = null,
                sourceUrl = kr.detailUrl,
                imageUrl = kr.imageUrl,
                price = parsePriceYen(kr.priceText),
            )
        }
    }

    private data class Card(
        val id: String,
        val title: String,
        val detailUrl: String,
        val imageUrl: String?,
        val priceText: String?,
    )

    private fun parseCards(doc: Document): List<Card> =
        doc.select("a.c-card.p-card").mapNotNull { el ->
            val href = el.attr("abs:href")
            val id = ITEM_ID_PATTERN.find(href)?.groupValues?.get(1) ?: return@mapNotNull null
            val title =
                el
                    .selectFirst(".p-card__tit")
                    ?.text()
                    ?.trim()
                    ?.takeUnless { it.isBlank() } ?: return@mapNotNull null
            Card(
                id = id,
                title = title,
                detailUrl = href,
                imageUrl = el.selectFirst(".p-card__img img")?.attr("abs:src")?.takeUnless { it.isBlank() },
                priceText = el.selectFirst(".p-card__price")?.text()?.trim(),
            )
        }

    // "(가칭) HG 1/144 ..." 처럼 붙는 임시명 표기를 걷어낸 뒤 첫 단어가 MG/HG/RG/PG 와 정확히 일치할 때만 등급으로 인정
    // (HGUC/MGEX 등 다른 접두어까지 잘못 포함되지 않도록 startsWith 대신 첫 단어 완전 일치로 검사)
    private fun gradeOf(title: String): String? {
        val firstWord = LEADING_PAREN_PATTERN.replace(title, "").trim().substringBefore(' ')
        return firstWord.takeIf { it in GRADES }
    }

    // "1,300엔" → 1300 (엔화 금액)
    private fun parsePriceYen(priceText: String?): BigDecimal? =
        priceText?.let {
            PRICE_DIGITS_PATTERN
                .find(it)
                ?.value
                ?.replace(",", "")
                ?.toBigDecimalOrNull()
        }

    private fun fetchDoc(url: String): Document {
        val request =
            HttpRequest
                .newBuilder(URI(url))
                .header(HttpHeaders.USER_AGENT, USER_AGENT)
                .header(HttpHeaders.ACCEPT, "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                .header(HttpHeaders.ACCEPT_LANGUAGE, "ko,en;q=0.9,ja;q=0.8")
                .timeout(Duration.ofSeconds(20))
                .build()
        val response = HTTP_CLIENT.send(request, BodyHandlers.ofString())
        check(response.statusCode() == 200) { "bandai-hobby schedule fetch failed: HTTP ${response.statusCode()} from $url" }
        return Jsoup.parse(response.body(), url)
    }

    companion object {
        private const val SOURCE_NAME = "반다이 하비 글로벌"
        private const val KR_BASE = "https://global.bandai-hobby.net/kr"
        private const val EN_BASE = "https://global.bandai-hobby.net/en-us"
        private const val JP_BASE = "https://bandai-hobby.net"
        private const val MONTH_SPAN = 6
        private const val FETCH_CONCURRENCY = 4
        private const val USER_AGENT =
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"

        private val MONTH_FORMAT = DateTimeFormatter.ofPattern("yyyyMM")
        private val ITEM_ID_PATTERN = Regex("""/item/([^/]+)/""")
        private val LEADING_PAREN_PATTERN = Regex("""^[(（][^)）]*[)）]\s*""")
        private val PRICE_DIGITS_PATTERN = Regex("""[\d,]+""")
        private val GRADES = setOf("MG", "HG", "RG", "PG")

        private val HTTP_CLIENT: HttpClient =
            HttpClient
                .newBuilder()
                .followRedirects(HttpClient.Redirect.NORMAL)
                .connectTimeout(Duration.ofSeconds(10))
                .build()
    }
}
