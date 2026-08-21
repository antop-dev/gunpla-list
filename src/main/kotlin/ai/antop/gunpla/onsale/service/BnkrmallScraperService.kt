package ai.antop.gunpla.onsale.service

import ai.antop.gunpla.onsale.dto.OnSaleProductDto
import io.github.oshai.kotlinlogging.KotlinLogging
import org.jsoup.Jsoup
import org.jsoup.nodes.Document
import org.springframework.core.annotation.Order
import org.springframework.http.HttpHeaders
import org.springframework.stereotype.Service
import java.math.BigDecimal
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse.BodyHandlers
import java.time.Duration
import java.util.concurrent.Callable
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

private val log = KotlinLogging.logger {}

// 반다이남코코리아몰(bnkrmall.co.kr)에서 건프라 목록을 수집 — 프리미엄반다이 목록 페이지와 등급별(HG/RG/MG/PG) 카테고리
// 목록 페이지(페이지네이션 전체)를 스크래핑해 등급/제품명/상태/판매가격/링크를 추출한 순서 그대로 반환(중복 제거/DB 비교는 하지 않음)
// 프리미엄반다이가 최상위 — 한정판/응모 제품 위주라 우선 확인해야 할 항목이 많음
// 등급별 카테고리 페이지는 chkbrand 쿼리 파라미터로 등급이 이미 고정되어 있고, 프리미엄반다이는 여러 등급이 섞여 있어
// 제품명 앞의 HG/RG/MG/MGEX/PG 표기를 등급으로 파싱한다(그 외 표기는 건프라가 아닌 것으로 보고 건너뜀)
// MGEX 는 이 사이트에 전용 카테고리(chkbrand)가 없어 MG 카테고리에 섞여 나오므로 제품명 앞 표기로 다시 구분한다
@Service
@Order(1)
class BnkrmallScraperService : OnSaleScraperService {
    override fun scrapeAll(): List<OnSaleProductDto> {
        val executor: ExecutorService = Executors.newFixedThreadPool(FETCH_CONCURRENCY)
        val rows =
            try {
                scrapePremium() + GRADE_BRANDS.flatMap { (grade, brand) -> scrapeGrade(grade, brand, executor) }
            } finally {
                executor.shutdown()
            }
        log.info { "bnkrmall: found ${rows.size} items" }
        return rows
    }

    // 카테고리 목록 페이지(등급 하나) — 1페이지를 먼저 받아 총 페이지 수를 확인한 뒤, 나머지 페이지는 병렬로 수집하되
    // 결과는 페이지 오름차순으로 이어붙여 "추출한 순서"를 보존한다
    private fun scrapeGrade(
        grade: String,
        brand: Int,
        executor: ExecutorService,
    ): List<OnSaleProductDto> {
        val firstDoc = fetchDoc(gradeUrl(brand, 1))
        val firstItems = parseGradeItems(firstDoc, grade)
        val totalPages = totalPages(firstDoc)
        if (totalPages <= 1) return firstItems

        val restItems =
            (2..totalPages)
                .map { page -> executor.submit(Callable { parseGradeItems(fetchDoc(gradeUrl(brand, page)), grade) }) }
                .flatMap { it.get() }
        return firstItems + restItems
    }

    private fun parseGradeItems(
        doc: Document,
        grade: String,
    ): List<OnSaleProductDto> =
        doc.select("div.product-wrap li").mapNotNull { li ->
            val url = li.selectFirst("a")?.attr("abs:href")?.takeUnless { it.isBlank() } ?: return@mapNotNull null
            val name = li.selectFirst("h5")?.text()?.trim()?.takeUnless { it.isBlank() } ?: return@mapNotNull null
            val itemGrade = refineGrade(name, grade)
            OnSaleProductDto(
                source = SOURCE_NAME,
                grade = itemGrade,
                name = stripGradePrefix(name, itemGrade),
                status = classifyStatus(li.selectFirst("div.thumb-dim")?.text()),
                price = parsePrice(li.selectFirst("div.price")?.text()),
                url = url,
                imageUrl = extractImageUrl(li.selectFirst("div.img_box")?.attr("style")),
            )
        }

    // 페이지네이션 버튼의 onclick="javascript:pageLink('N');" 중 가장 큰 N 을 총 페이지 수로 사용(없으면 1페이지)
    private fun totalPages(doc: Document): Int =
        PAGE_LINK_PATTERN.findAll(doc.html()).mapNotNull { it.groupValues[1].toIntOrNull() }.maxOrNull() ?: 1

    private fun gradeUrl(
        brand: Int,
        page: Int,
    ): String = "$GOODS_BASE?cate=1576&pview=&psort=NEW&cateName=$CATE_NAME_ENCODED&page=$page&chkbrand=$brand"

    // 프리미엄반다이 — 등급이 여러 개 섞여 있어 제품명 앞의 HG/RG/MG/MGEX/PG 표기를 등급으로 분리
    private fun scrapePremium(): List<OnSaleProductDto> {
        val doc = fetchDoc(PREMIUM_URL)
        return doc.select("div.list a").mapNotNull { a ->
            val url = a.attr("abs:href").takeUnless { it.isBlank() } ?: return@mapNotNull null
            val rawName = a.selectFirst("div.text_box p.name")?.text()?.trim().orEmpty()
            val (grade, name) = splitGradeAndName(rawName) ?: return@mapNotNull null
            OnSaleProductDto(
                source = SOURCE_NAME,
                grade = grade,
                name = name,
                status = classifyStatus(a.selectFirst("div.info_area p.text")?.text()),
                price = parsePrice(a.selectFirst("div.text_box p.price")?.text()),
                url = url,
                imageUrl = extractImageUrl(a.selectFirst("div.area")?.attr("style")),
            )
        }
    }

    // "HG 지라인 라이트 아머 [프리미엄 반다이]" → grade="HG", name="지라인 라이트 아머 [프리미엄 반다이]"
    // 첫 단어가 GRADES 에 없으면(건프라 외 제품 등) 건너뜀
    private fun splitGradeAndName(rawName: String): Pair<String, String>? {
        if (rawName.isBlank()) return null
        val firstWord = rawName.substringBefore(' ')
        if (firstWord !in GRADES) return null
        val rest = rawName.removePrefix(firstWord).trim()
        return firstWord to rest.ifBlank { rawName }
    }

    // 카테고리(chkbrand)로 고정된 등급 안에 섞여 있는 세부 등급을 제품명 앞 표기로 다시 확인 — 없으면 카테고리 등급 그대로 사용
    private fun refineGrade(
        name: String,
        categoryGrade: String,
    ): String = NESTED_GRADES[categoryGrade]?.firstOrNull { name.startsWith("$it ", ignoreCase = true) } ?: categoryGrade

    // 카테고리 목록 페이지는 이미 등급이 고정돼 있으나, 제품명 앞에 같은 등급 표기가 중복으로 붙어 있으면 걷어냄
    private fun stripGradePrefix(
        name: String,
        grade: String,
    ): String = name.removePrefix("$grade ").trim().ifBlank { name }

    // thumb-dim / info_area 텍스트에서 상태를 분류 — 판매중/품절 두 가지만 사용(예약·구매진행중·상시구매진행중 등은 모두 판매중으로 취급)
    private fun classifyStatus(text: String?): String {
        val t = text?.trim().orEmpty()
        return if (SOLD_OUT_KEYWORDS.any { t.contains(it) }) OnSaleProductDto.STATUS_SOLD_OUT else OnSaleProductDto.STATUS_ON_SALE
    }

    // "31,200원" → 31200
    private fun parsePrice(text: String?): BigDecimal? =
        text?.let { PRICE_DIGITS_PATTERN.find(it)?.value?.replace(",", "")?.toBigDecimalOrNull() }

    // style="background-image:url('//cdn.bnkrmall.co.kr/...')" 에서 이미지 URL 추출 — 프로토콜 생략(//) 표기는 https 로 보정
    private fun extractImageUrl(styleAttr: String?): String? {
        val raw = styleAttr?.let { BACKGROUND_IMAGE_PATTERN.find(it)?.groupValues?.get(1) }?.takeUnless { it.isBlank() }
        return raw?.let { if (it.startsWith("//")) "https:$it" else it }
    }

    private fun fetchDoc(url: String): Document {
        val request =
            HttpRequest
                .newBuilder(URI(url))
                .header(HttpHeaders.USER_AGENT, USER_AGENT)
                .header(HttpHeaders.ACCEPT, "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                .header(HttpHeaders.ACCEPT_LANGUAGE, "ko,en;q=0.9")
                .timeout(Duration.ofSeconds(20))
                .build()
        val response = HTTP_CLIENT.send(request, BodyHandlers.ofString())
        check(response.statusCode() == 200) { "bnkrmall fetch failed: HTTP ${response.statusCode()} from $url" }
        return Jsoup.parse(response.body(), url)
    }

    companion object {
        private const val SOURCE_NAME = "반다이남코코리아몰"

        private const val GOODS_BASE = "https://www.bnkrmall.co.kr/goods/category.do"
        private const val CATE_NAME_ENCODED = "%EA%B1%B4%ED%94%84%EB%9D%BC"
        private const val PREMIUM_URL = "https://www.bnkrmall.co.kr/premium/p_category.do?gun=Y"
        private const val FETCH_CONCURRENCY = 4
        private const val USER_AGENT =
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"

        // (등급, chkbrand) — HG/RG/MG/PG 순서 그대로 결과에 반영됨
        private val GRADE_BRANDS =
            listOf(
                "HG" to 180,
                "RG" to 181,
                "MG" to 182,
                "PG" to 183,
            )

        // 전용 카테고리가 없어 상위 등급 카테고리에 섞여 나오는 등급 (카테고리 등급 → 제품명 앞 표기로 구분할 등급들)
        private val NESTED_GRADES = mapOf("MG" to listOf("MGEX"))
        private val GRADES = GRADE_BRANDS.map { it.first }.toSet() + NESTED_GRADES.values.flatten()

        private val PAGE_LINK_PATTERN = Regex("""pageLink\('(\d+)'\)""")
        private val PRICE_DIGITS_PATTERN = Regex("""[\d,]+""")
        private val BACKGROUND_IMAGE_PATTERN = Regex("""url\(['"]?([^'")]+)['"]?\)""")
        private val SOLD_OUT_KEYWORDS = listOf("SOLD OUT", "품절", "종료")

        private val HTTP_CLIENT: HttpClient =
            HttpClient
                .newBuilder()
                .followRedirects(HttpClient.Redirect.NORMAL)
                .connectTimeout(Duration.ofSeconds(10))
                .build()
    }
}
