package ai.antop.gunpla.onsale.service

import ai.antop.gunpla.onsale.dto.OnSaleProductDto
import io.github.oshai.kotlinlogging.KotlinLogging
import org.jsoup.Jsoup
import org.jsoup.nodes.Document
import org.jsoup.nodes.Element
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

// 네이버+ 스토어(brand.naver.com/bandai) "건담프라모델" 카테고리에서 건프라 목록을 수집 — 페이지네이션 전체를 병렬로 순회
// 예전에는 제품 카드의 data-shp-contents-dtl 속성(JSON)에서 제품명/가격을 뽑았지만, 사이트 리뉴얼로 이 속성이
// 완전히 사라져 화면에 보이는 구조를 그대로 사용한다: 제품명은 <strong> 텍스트, 가격은 "26,400원"처럼
// 숫자 span 바로 뒤에 "원"만 담긴 단독 span 이 붙는 구조를 이용해 추출한다(배송비도 "...원" 형태지만 span 이 아닌
// 일반 텍스트 노드라 이 방식에는 걸리지 않는다). CSS 클래스명은 빌드마다 해시가 바뀌므로 절대 의존하지 않는다.
// 제품명 첫 단어의 앞 두 글자가 등급(HG/RG/MG/PG)인 것만 건프라로 인정(HGUC 등도 앞 두 글자 기준으로 포함)
// 단 MGSD/MGEX 는 MG 와 별개 등급이라 첫 단어가 정확히 MGSD/MGEX 일 때 그대로 등급으로 사용
@Service
@Order(2)
class NaverBandaiScraperService : OnSaleScraperService {
    override fun scrapeAll(): List<OnSaleProductDto> {
        val firstUrl = categoryUrl(1)
        val firstHtml = fetchHtml(firstUrl)
        val firstItems = parseItems(Jsoup.parse(firstHtml, firstUrl))
        val totalPages = totalPages(firstHtml)
        if (totalPages <= 1) {
            log.info { "naver bandai: found ${firstItems.size} items" }
            return firstItems
        }

        val executor: ExecutorService = Executors.newFixedThreadPool(FETCH_CONCURRENCY)
        val rows =
            try {
                val restItems =
                    (2..totalPages)
                        .map { page -> executor.submit(Callable { parseItems(fetchDoc(categoryUrl(page))) }) }
                        .flatMap { it.get() }
                firstItems + restItems
            } finally {
                executor.shutdown()
            }
        log.info { "naver bandai: found ${rows.size} items" }
        return rows
    }

    private fun parseItems(doc: Document): List<OnSaleProductDto> =
        doc.select("div#CategoryProducts ul li").mapNotNull { li ->
            val a = li.selectFirst("a[href*=\"/products/\"]") ?: return@mapNotNull null
            val url = a.attr("abs:href").takeUnless { it.isBlank() } ?: return@mapNotNull null
            val rawName = li.selectFirst("strong")?.text()?.trim().orEmpty()
            val (grade, name) = splitGradeAndName(rawName) ?: return@mapNotNull null
            OnSaleProductDto(
                source = SOURCE_NAME,
                grade = grade,
                name = name,
                status = if (li.text().contains("품절")) OnSaleProductDto.STATUS_SOLD_OUT else OnSaleProductDto.STATUS_ON_SALE,
                price = extractPrice(li),
                url = url,
                imageUrl = li.selectFirst("img")?.attr("abs:src")?.takeUnless { it.isBlank() },
            )
        }

    // "26,400원" 은 숫자만 담긴 span 바로 뒤에 "원"만 담긴(자식 요소 없는) span 이 붙는 구조로 렌더링된다.
    // 배송비("3,000원")는 같은 블록에 있지만 span 으로 감싸여 있지 않은 일반 텍스트라 이 조건에 걸리지 않는다.
    private fun extractPrice(li: Element): BigDecimal? {
        val wonSpan =
            li.select("span").firstOrNull { it.children().isEmpty() && it.ownText().trim() == "원" }
                ?: return null
        val priceSpan = wonSpan.previousElementSibling() ?: return null
        return priceSpan.text().replace(",", "").toBigDecimalOrNull()
    }

    // "HGUC 구프 커스텀" → grade="HG", name="구프 커스텀" (첫 단어 앞 두 글자가 등급) — 등급이 아니면(건프라 외 제품) 건너뜀
    // "MGEX 스트라이크 프리덤 건담" → grade="MGEX", "MGSD 프리덤 건담" → grade="MGSD"
    // (앞 두 글자로 줄이면 둘 다 MG 가 되므로 첫 단어 완전 일치를 먼저 확인)
    private fun splitGradeAndName(rawName: String): Pair<String, String>? {
        if (rawName.isBlank()) return null
        val firstWord = rawName.substringBefore(' ')
        val upperFirstWord = firstWord.uppercase()
        val grade = if (upperFirstWord in EXACT_GRADES) upperFirstWord else upperFirstWord.take(2)
        if (grade !in GRADES) return null
        val rest = rawName.removePrefix(firstWord).trim()
        return grade to rest.ifBlank { rawName }
    }

    // "(총 <strong>1,134</strong>개)" 에서 총 제품 수를 추출해 총 페이지 수(올림)로 환산 — 못 찾으면 1페이지로 간주
    private fun totalPages(html: String): Int {
        val count =
            TOTAL_COUNT_PATTERN
                .find(html)
                ?.groupValues
                ?.get(1)
                ?.replace(",", "")
                ?.toIntOrNull() ?: return 1
        return ((count + PAGE_SIZE - 1) / PAGE_SIZE).coerceAtLeast(1)
    }

    private fun categoryUrl(page: Int): String = "$CATEGORY_BASE?st=POPULAR&dt=LIST&page=$page&size=$PAGE_SIZE"

    private fun fetchDoc(url: String): Document = Jsoup.parse(fetchHtml(url), url)

    // Referer 가 없으면(2페이지 이상) 서버가 상품 목록 없이 빈 뼈대만 내려준다 — 카테고리 기본 URL을
    // Referer 로 보내면 실제 방문처럼 취급해 정상적으로 상품 목록을 채워서 내려준다(1페이지는 원래도 문제없음)
    private fun fetchHtml(url: String): String {
        val request =
            HttpRequest
                .newBuilder(URI(url))
                .header(HttpHeaders.USER_AGENT, USER_AGENT)
                .header(HttpHeaders.ACCEPT, "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                .header(HttpHeaders.ACCEPT_LANGUAGE, "ko,en;q=0.9")
                .header(HttpHeaders.REFERER, CATEGORY_BASE)
                .timeout(Duration.ofSeconds(20))
                .build()
        val response = HTTP_CLIENT.send(request, BodyHandlers.ofString())
        check(response.statusCode() == 200) { "naver bandai fetch failed: HTTP ${response.statusCode()} from $url" }
        return response.body()
    }

    companion object {
        private const val SOURCE_NAME = "네이버+ 스토어"
        private const val CATEGORY_BASE = "https://brand.naver.com/bandai/category/1347a2688556428296a3a7601dbcf494"
        private const val PAGE_SIZE = 80
        private const val FETCH_CONCURRENCY = 4
        private const val USER_AGENT =
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"

        // 앞 두 글자만 떼면 MG 가 되어버리는 MG 계열 파생 등급 — 첫 단어 완전 일치로 먼저 판정해야 함
        private val EXACT_GRADES = setOf("MGSD", "MGEX")
        private val GRADES = setOf("HG", "RG", "MG", "PG") + EXACT_GRADES
        private val TOTAL_COUNT_PATTERN = Regex("""총\s*<strong>([\d,]+)</strong>""")

        private val HTTP_CLIENT: HttpClient =
            HttpClient
                .newBuilder()
                .followRedirects(HttpClient.Redirect.NORMAL)
                .connectTimeout(Duration.ofSeconds(10))
                .build()
    }
}
