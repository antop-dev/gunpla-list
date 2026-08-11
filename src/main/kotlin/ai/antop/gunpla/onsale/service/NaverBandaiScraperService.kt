package ai.antop.gunpla.onsale.service

import ai.antop.gunpla.onsale.dto.OnSaleProductDto
import io.github.oshai.kotlinlogging.KotlinLogging
import org.jsoup.Jsoup
import org.jsoup.nodes.Document
import org.springframework.core.annotation.Order
import org.springframework.http.HttpHeaders
import org.springframework.stereotype.Service
import tools.jackson.databind.ObjectMapper
import tools.jackson.databind.node.ArrayNode
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
// 제품 카드마다 data-shp-contents-dtl 속성(JSON 배열: [{"key":"chnl_prod_nm","value":"..."},{"key":"price","value":"..."}])에서
// 제품명/판매가격을 추출하며, 제품명 첫 단어의 앞 두 글자가 등급(HG/RG/MG/PG)인 것만 건프라로 인정(HGUC/MGEX 등도 앞 두 글자 기준으로 포함)
@Service
@Order(2)
class NaverBandaiScraperService(
    private val objectMapper: ObjectMapper,
) : OnSaleScraperService {
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
            val a = li.selectFirst("a[data-shp-contents-dtl]") ?: return@mapNotNull null
            val url = a.attr("abs:href").takeUnless { it.isBlank() } ?: return@mapNotNull null
            val dtl = a.attr("data-shp-contents-dtl")
            val rawName = extractDtlValue(dtl, "chnl_prod_nm")?.trim().orEmpty()
            val (grade, name) = splitGradeAndName(rawName) ?: return@mapNotNull null
            OnSaleProductDto(
                source = SOURCE_NAME,
                grade = grade,
                name = name,
                status = if (li.text().contains("품절")) OnSaleProductDto.STATUS_SOLD_OUT else OnSaleProductDto.STATUS_ON_SALE,
                price = extractDtlValue(dtl, "price")?.toBigDecimalOrNull(),
                url = url,
                imageUrl = li.selectFirst("img")?.attr("abs:src")?.takeUnless { it.isBlank() },
            )
        }

    // "HGUC 구프 커스텀" → grade="HG", name="구프 커스텀" (첫 단어 앞 두 글자가 등급) — 등급이 아니면(건프라 외 제품) 건너뜀
    private fun splitGradeAndName(rawName: String): Pair<String, String>? {
        if (rawName.isBlank()) return null
        val firstWord = rawName.substringBefore(' ')
        val grade = firstWord.take(2).uppercase()
        if (grade !in GRADES) return null
        val rest = rawName.removePrefix(firstWord).trim()
        return grade to rest.ifBlank { rawName }
    }

    // data-shp-contents-dtl="[{"key":"chnl_prod_nm","value":"..."},{"key":"price","value":"..."}]" 에서 key 로 value 조회
    private fun extractDtlValue(
        raw: String,
        key: String,
    ): String? {
        val array = runCatching { objectMapper.readTree(raw) as? ArrayNode }.getOrNull() ?: return null
        return array
            .elements()
            .firstOrNull { it.get("key")?.asString() == key }
            ?.get("value")
            ?.asString()
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

    private fun fetchHtml(url: String): String {
        val request =
            HttpRequest
                .newBuilder(URI(url))
                .header(HttpHeaders.USER_AGENT, USER_AGENT)
                .header(HttpHeaders.ACCEPT, "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                .header(HttpHeaders.ACCEPT_LANGUAGE, "ko,en;q=0.9")
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

        private val GRADES = setOf("HG", "RG", "MG", "PG")
        private val TOTAL_COUNT_PATTERN = Regex("""총\s*<strong>([\d,]+)</strong>""")

        private val HTTP_CLIENT: HttpClient =
            HttpClient
                .newBuilder()
                .followRedirects(HttpClient.Redirect.NORMAL)
                .connectTimeout(Duration.ofSeconds(10))
                .build()
    }
}
