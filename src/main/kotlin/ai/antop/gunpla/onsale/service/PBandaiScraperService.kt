package ai.antop.gunpla.onsale.service

import ai.antop.gunpla.onsale.dto.OnSaleProductDto
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.core.annotation.Order
import org.springframework.http.HttpHeaders
import org.springframework.stereotype.Service
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse.BodyHandlers
import java.time.Duration
import java.util.concurrent.Callable
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

private val log = KotlinLogging.logger {}

// PREMIUM BANDAI USA(p-bandai.com) "GUNDAM" 시리즈(_f_series=03-001)에서 건프라 목록을 수집 — 페이지네이션 전체를 병렬로 순회
// /api/search 는 서버 렌더링되지 않는 SPA 뒷단 JSON API 로, X-Requested-With 등 프론트엔드가 보내는 헤더가 없으면 500 을 반환함
// 제품명 첫 단어의 앞 두 글자가 등급(HG/RG/MG/PG)인 것만 건프라로 인정하되 MGEX 는 별개 등급으로 인정하며,
// flags 에 OUT_OF_STOCK 이 있거나 saleStatus 가 On 이 아니면 품절로 간주
@Service
@Order(3)
class PBandaiScraperService(
    private val objectMapper: ObjectMapper,
) : OnSaleScraperService {
    override fun scrapeAll(): List<OnSaleProductDto> {
        val firstNode = fetchPage(0)
        val firstItems = parseItems(firstNode)
        val totalCount = firstNode.get("totalCount")?.asInt() ?: 0
        val totalPages = ((totalCount + PAGE_SIZE - 1) / PAGE_SIZE).coerceAtLeast(1)
        if (totalPages <= 1) {
            log.info { "p-bandai: found ${firstItems.size} items" }
            return firstItems
        }

        val executor: ExecutorService = Executors.newFixedThreadPool(FETCH_CONCURRENCY)
        val rows =
            try {
                val restItems =
                    (1 until totalPages)
                        .map { page -> executor.submit(Callable { parseItems(fetchPage(page * PAGE_SIZE)) }) }
                        .flatMap { it.get() }
                firstItems + restItems
            } finally {
                executor.shutdown()
            }
        log.info { "p-bandai: found ${rows.size} items" }
        return rows
    }

    private fun parseItems(productResults: JsonNode): List<OnSaleProductDto> =
        productResults.get("products").orEmpty().mapNotNull { product ->
            val productCode = product.get("productCode")?.asString() ?: return@mapNotNull null
            val rawName = product.get("productName")?.get("en")?.asString()?.trim().orEmpty()
            val (grade, name) = splitGradeAndName(rawName) ?: return@mapNotNull null
            val saleStatus = product.get("saleStatus")?.asString()
            val flags = product.get("flags").orEmpty().map { it.asString() }
            val outOfStock = flags.contains("OUT_OF_STOCK")
            val onSale = saleStatus == "On" && !outOfStock
            // productFlags[0].labelName.en 텍스트 기준: IN STOCK(사전예약 아님)/PRE-ORDER(사전예약)/
            // ORDER CLOSED(사전예약 아님, 품절)/PRE-ORDER CLOSED(사전예약 종료, 품절) — flags 코드로 동일하게 판별 가능
            val isReservation = flags.contains("PRE_ORDER") || flags.contains("PRE_ORDER_CLOSED")
            OnSaleProductDto(
                source = SOURCE_NAME,
                grade = grade,
                name = name,
                status = if (onSale) OnSaleProductDto.STATUS_ON_SALE else OnSaleProductDto.STATUS_SOLD_OUT,
                price = extractPrice(product),
                currency = OnSaleProductDto.CURRENCY_USD,
                url = "$SITE_BASE/us/item/$productCode",
                isReservation = isReservation,
                imageUrl =
                    product
                        .get("productImages")
                        .orEmpty()
                        .firstOrNull()
                        ?.get("fileUrl")
                        ?.asString()
                        ?.takeUnless { it.isBlank() }
                        ?.let { "$SITE_BASE/$it" },
            )
        }

    // fixedPrice=true 면 fixedListPrice, 아니면 baseListPrice 에서 금액을 읽음(프론트엔드 ProductItem 컴포넌트와 동일한 규칙)
    private fun extractPrice(product: JsonNode): java.math.BigDecimal? {
        val fixedPrice = product.get("fixedPrice")?.asBoolean() == true
        val priceNode = if (fixedPrice) product.get("fixedListPrice") else product.get("baseListPrice")
        val amount = priceNode?.get("amount") ?: return null
        return if (amount.isNumber) amount.decimalValue() else null
    }

    // "HG 1/144 GUNDAM L.O.BOOSTER" → grade="HG", name="GUNDAM L.O.BOOSTER" — 등급이 아니면(건프라 외 제품) 건너뜀
    // "MGEX 1/100 STRIKE FREEDOM GUNDAM" → grade="MGEX" (앞 두 글자로 줄이면 MG 가 되므로 첫 단어 완전 일치를 먼저 확인)
    // 등급 다음에 오는 축척 표기(1/144, 1/100, 1/60)는 제품명에서 제외
    private fun splitGradeAndName(rawName: String): Pair<String, String>? {
        if (rawName.isBlank()) return null
        val firstWord = rawName.substringBefore(' ')
        val upperFirstWord = firstWord.uppercase()
        val grade = if (upperFirstWord == GRADE_MGEX) GRADE_MGEX else upperFirstWord.take(2)
        if (grade !in GRADES) return null
        val rest = rawName.removePrefix(firstWord).trim()
        val scale = SCALES.find { rest.startsWith("$it ") || rest == it }
        val withoutScale = scale?.let { rest.removePrefix(it).trim() } ?: rest
        return grade to withoutScale.ifBlank { rawName }
    }

    private fun fetchPage(offset: Int): JsonNode {
        val url = "$SEARCH_URL&offset=$offset&limit=$PAGE_SIZE"
        val request =
            HttpRequest
                .newBuilder(URI(url))
                .header(HttpHeaders.USER_AGENT, USER_AGENT)
                .header(HttpHeaders.ACCEPT, "application/json, text/plain, */*")
                .header(HttpHeaders.ACCEPT_LANGUAGE, "en-US")
                .header("X-Requested-With", "XMLHttpRequest")
                .header("X-G1-Area-Code", "us")
                .timeout(Duration.ofSeconds(20))
                .build()
        val response = HTTP_CLIENT.send(request, BodyHandlers.ofString())
        check(response.statusCode() == 200) { "p-bandai fetch failed: HTTP ${response.statusCode()} from $url" }
        return objectMapper.readTree(response.body()).get("productResults")
    }

    private fun JsonNode?.orEmpty(): List<JsonNode> = this?.values()?.toList().orEmpty()

    companion object {
        private const val SOURCE_NAME = "PREMIUM BANDAI"
        private const val SITE_BASE = "https://p-bandai.com"
        private const val SEARCH_URL =
            "$SITE_BASE/api/search?keyword=&_f_productStatuses=Waiting,On,End&_f_series=03-001&sortType=NewArrival&includeAggs=false"
        private const val PAGE_SIZE = 200
        private const val FETCH_CONCURRENCY = 4
        private const val USER_AGENT =
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"

        private const val GRADE_MGEX = "MGEX"
        private val GRADES = setOf("HG", "RG", "MG", GRADE_MGEX, "PG")
        private val SCALES = setOf("1/144", "1/100", "1/60")

        private val HTTP_CLIENT: HttpClient =
            HttpClient
                .newBuilder()
                .followRedirects(HttpClient.Redirect.NORMAL)
                .connectTimeout(Duration.ofSeconds(10))
                .build()
    }
}
