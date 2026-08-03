package ai.antop.gunpla.productrelease.service

import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.http.HttpHeaders
import org.springframework.stereotype.Service
import tools.jackson.databind.ObjectMapper
import tools.jackson.databind.node.ArrayNode
import java.net.URI
import java.net.URLEncoder
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpRequest.BodyPublishers
import java.net.http.HttpResponse.BodyHandlers
import java.nio.charset.StandardCharsets
import java.time.Duration
import java.util.concurrent.Callable
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

private val log = KotlinLogging.logger {}

// gunpla.fyi(개인 건프라 데이터베이스)에서 등급별 상품 목록을 수집
// SvelteKit 정적 사이트라 별도 조회 API가 없고, 전체 상품 배열이 라우트 JS 청크(nodes/N.<해시>.js) 안에
// `JSON.parse(\`[...]\`)` 형태로 통째로 임베드되어 있음. 파일명 해시는 빌드마다 바뀌므로
// 진입 HTML → entry/app.<해시>.js(라우트 매니페스트) → nodes/*.js 순으로 매번 새로 경로를 찾아 접근한다
// 일본어 이름(nameJp)만 제공하고 한국어가 없어 DB(한국어 제품명)와 이름 매칭이 안 되므로,
// 구글 번역 비공식 엔드포인트(translate.googleapis.com)로 일→한 배치 번역 후 정규화 매칭에 사용한다
// (번역 기반 매칭이라 완벽하지 않음 — 후보 목록이므로 관리자가 최종 검수)
// nameEn(영문명)도 함께 제공되므로 번역 없이 그대로 ScrapedProductRow.nameEn 에 담아 화면에 참고용으로 노출
// 박스아트 이미지는 https://gunpla.fyi/images/boxarts/{id}.jpeg 패턴으로 항목당 하나씩 존재(별도 API 응답 필드 아님, id 로 URL 조합)
@Service
class GunplaFyiScraperService(
    private val objectMapper: ObjectMapper,
) : ProductScraperService {
    override fun scrapeAll(): List<ScrapedProductRow> {
        val items =
            fetchAllItems().mapNotNull { item ->
                val grade = BRAND_TO_GRADE[item.brand.trim()] ?: return@mapNotNull null
                item to grade
            }
        if (items.isEmpty()) return emptyList()

        val strippedJpNames = items.map { (item, _) -> stripPrefix(normalizeFullwidth(item.nameJp)) }
        val seriesTexts = items.mapNotNull { (item, _) -> item.series }
        val translations = translateBatch(strippedJpNames + seriesTexts)

        return items.map { (item, grade) ->
            val strippedJpName = stripPrefix(normalizeFullwidth(item.nameJp))
            val translatedName = translations[strippedJpName] ?: strippedJpName
            val translatedSeries = item.series?.let { translations[it] ?: it }
            val strippedEnName = item.nameEn?.let { stripPrefix(normalizeFullwidth(it)) }
            ScrapedProductRow(
                grade = grade,
                source = SOURCE_NAME,
                nameKo = translatedName,
                nameEn = strippedEnName,
                nameJp = strippedJpName,
                modelNumber = null,
                dateText = normalizeDate(item.releaseDate),
                series = translatedSeries,
                sourceUrl = "$MANUAL_URL_BASE/${item.id}",
                imageUrl = "$IMAGE_URL_BASE/${item.id}.jpeg",
            )
        }
    }

    // 임베드된 상품 배열 파싱 대상 원본 항목
    private data class RawItem(
        val id: String,
        val nameJp: String,
        val nameEn: String?,
        val releaseDate: String?,
        val brand: String,
        val series: String?,
    )

    private fun fetchAllItems(): List<RawItem> {
        val entryAppJsPath = fetchEntryAppJsPath()
        val appJs = fetchText("$BASE_URL$entryAppJsPath")
        val nodePaths =
            NODE_REF_PATTERN
                .findAll(appJs)
                .map { it.value }
                .distinct()
                .sortedByDescending {
                    NODE_INDEX_PATTERN
                        .find(it)
                        ?.groupValues
                        ?.get(1)
                        ?.toIntOrNull() ?: -1
                }.toList()
        for (nodePath in nodePaths) {
            val nodeJs = fetchText("$BASE_URL/_app/immutable/$nodePath")
            if (DATA_MARKER in nodeJs) {
                log.info { "gunpla.fyi: found embedded product data in $nodePath" }
                return parseEmbeddedArray(nodeJs)
            }
        }
        error("gunpla.fyi: could not locate embedded product data in any node chunk (${nodePaths.size} candidates tried)")
    }

    private fun fetchEntryAppJsPath(): String {
        val html = fetchText(BASE_URL)
        val match = ENTRY_APP_PATTERN.find(html) ?: error("gunpla.fyi: entry app.js reference not found in root HTML")
        return match.groupValues[1]
    }

    // JS 템플릿 리터럴로 감싼 JSON 배열(`JSON.parse(\`[...]\`)`)을 실제 JSON 문자열로 복원 후 파싱
    // 백틱 문자열 규칙상 이스케이프는 \\ 와 \xHH 만 등장함(관찰된 범위 내) — 그 외 이스케이프도 방어적으로 처리
    private fun parseEmbeddedArray(js: String): List<RawItem> {
        val start = js.indexOf(DATA_MARKER).let { js.indexOf('`', it) + 1 }
        check(start > 0) { "gunpla.fyi: JSON.parse(\\`...\\`) marker not found" }
        val sb = StringBuilder()
        var i = start
        while (true) {
            val c = js[i]
            if (c == '\\') {
                when (val next = js[i + 1]) {
                    '\\' -> {
                        sb.append('\\')
                        i += 2
                    }

                    'x' -> {
                        sb.append(js.substring(i + 2, i + 4).toInt(16).toChar())
                        i += 4
                    }

                    'n' -> {
                        sb.append('\n')
                        i += 2
                    }

                    else -> {
                        sb.append(next)
                        i += 2
                    }
                }
                continue
            }
            if (c == '`') break
            sb.append(c)
            i++
        }
        val arrayNode = objectMapper.readTree(sb.toString()) as ArrayNode
        return arrayNode
            .elements()
            .asSequence()
            .map { node ->
                RawItem(
                    id = node.get("id").asString(),
                    nameJp = node.get("nameJp").asString(),
                    nameEn =
                        node
                            .get("nameEn")
                            ?.takeUnless { it.isNull }
                            ?.asString()
                            ?.takeUnless { it.isBlank() },
                    releaseDate = node.get("releaseDate")?.takeUnless { it.isNull }?.asString(),
                    brand = node.get("brand").asString(),
                    series = node.get("series")?.takeUnless { it.isNull }?.asString(),
                )
            }.toList()
    }

    // 전각(fullwidth) 영숫자/공백을 반각으로 변환 — 일부 항목이 "ＲＧ 1/144" 처럼 전각 등급 접두어를 사용함
    private fun normalizeFullwidth(text: String): String =
        text
            .map { c ->
                when {
                    c.code in 0xFF01..0xFF5E -> (c.code - 0xFEE0).toChar()
                    c.code == 0x3000 -> ' '
                    else -> c
                }
            }.joinToString("")

    // "HG 1/144 エールストライクガンダム" → "エールストライクガンダム" (등급/스케일 접두어 제거)
    private fun stripPrefix(name: String): String = PREFIX_PATTERN.replace(name, "").trim().ifBlank { name }

    // "2005-08-12"/"2005-05" → "2005.8"/"2005.5" (ProductReleaseService 의 파싱 형식에 맞춤), "N/A" 등은 null
    private fun normalizeDate(releaseDate: String?): String? {
        val parts = releaseDate?.split("-") ?: return null
        if (parts.size < 2) return null
        val year = parts[0].toIntOrNull() ?: return null
        val month = parts[1].toIntOrNull() ?: return null
        if (month !in 1..12) return null
        return "$year.$month"
    }

    // 구글 번역 비공식 엔드포인트로 일→한 배치 번역. 줄바꿈으로 묶어 한 번에 여러 문장을 번역하되,
    // 응답 줄 수가 입력과 어긋나면(문장 병합/분리) 절반씩 나눠 재시도해 항상 1:1 매칭을 보장
    private fun translateBatch(texts: List<String>): Map<String, String> {
        val unique = texts.filter { it.isNotBlank() }.distinct()
        if (unique.isEmpty()) return emptyMap()

        val result = ConcurrentHashMap<String, String>()
        val executor: ExecutorService = Executors.newFixedThreadPool(TRANSLATE_CONCURRENCY)
        try {
            unique
                .chunked(TRANSLATE_CHUNK_SIZE)
                .map { chunk -> executor.submit(Callable { translateChunk(chunk, result) }) }
                .forEach { it.get() }
        } finally {
            executor.shutdown()
        }
        return result
    }

    private fun translateChunk(
        chunk: List<String>,
        sink: MutableMap<String, String>,
    ) {
        if (chunk.isEmpty()) return
        val translated = callTranslateApi(chunk.joinToString("\n"))
        val lines = translated.split("\n")
        when {
            lines.size == chunk.size -> {
                chunk.forEachIndexed { i, original -> sink[original] = lines[i].trim() }
            }

            chunk.size == 1 -> {
                sink[chunk[0]] = translated.trim()
            }

            else -> {
                val mid = chunk.size / 2
                translateChunk(chunk.subList(0, mid), sink)
                translateChunk(chunk.subList(mid, chunk.size), sink)
            }
        }
    }

    private fun callTranslateApi(text: String): String {
        val formBody = "client=gtx&sl=ja&tl=ko&dt=t&q=" + URLEncoder.encode(text, StandardCharsets.UTF_8)
        val request =
            HttpRequest
                .newBuilder(URI(TRANSLATE_URL))
                .header(HttpHeaders.CONTENT_TYPE, "application/x-www-form-urlencoded")
                .header(HttpHeaders.USER_AGENT, USER_AGENT)
                .timeout(Duration.ofSeconds(20))
                .POST(BodyPublishers.ofString(formBody))
                .build()
        val response = HTTP_CLIENT.send(request, BodyHandlers.ofString())
        check(response.statusCode() == 200) { "Translate API failed: HTTP ${response.statusCode()}" }
        val segments = objectMapper.readTree(response.body()).get(0)
        return buildString { segments.forEach { seg -> append(seg.get(0).asText()) } }
    }

    private fun fetchText(url: String): String {
        val request =
            HttpRequest
                .newBuilder(URI(url))
                .header(HttpHeaders.USER_AGENT, USER_AGENT)
                .timeout(Duration.ofSeconds(20))
                .build()
        val response = HTTP_CLIENT.send(request, BodyHandlers.ofString())
        check(response.statusCode() == 200) { "gunpla.fyi fetch failed: HTTP ${response.statusCode()} from $url" }
        return response.body()
    }

    companion object {
        private const val SOURCE_NAME = "gunpla.fyi"
        private const val BASE_URL = "https://gunpla.fyi"
        private const val MANUAL_URL_BASE = "https://manual.bandai-hobby.net/menus/detail"
        private const val IMAGE_URL_BASE = "https://gunpla.fyi/images/boxarts"
        private const val TRANSLATE_URL = "https://translate.googleapis.com/translate_a/single"
        private const val TRANSLATE_CONCURRENCY = 4
        private const val TRANSLATE_CHUNK_SIZE = 80
        private const val USER_AGENT =
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
        private const val DATA_MARKER = "JSON.parse(`[{\"id\""

        private val ENTRY_APP_PATTERN = Regex("""(/_app/immutable/entry/app\.[^"]+\.js)""")
        private val NODE_REF_PATTERN = Regex("""nodes/\d+\.[^"'`)]+\.js""")
        private val NODE_INDEX_PATTERN = Regex("""nodes/(\d+)\.""")
        private val PREFIX_PATTERN = Regex("""^[A-Z0-9]+(?::[A-Z0-9]+)?\s+(?:\d+/\d+\s+)?""")

        // gunpla.fyi 원본 brand 값(사이트 자체 분류 코드) → 앱 등급값(HG/RG/MG/MGEX/PG) 매핑
        // HGUC(하이 그레이드 유니버설 센츄리)는 HG로, MGSD(마스터 그레이드 SD)는 MG로 편입
        private val BRAND_TO_GRADE =
            mapOf(
                "HG" to "HG",
                "HGUC" to "HG",
                "RG" to "RG",
                "MG" to "MG",
                "MGSD" to "MG",
                "MGEX" to "MGEX",
                "PG" to "PG",
            )

        private val HTTP_CLIENT: HttpClient =
            HttpClient
                .newBuilder()
                .followRedirects(HttpClient.Redirect.NORMAL)
                .connectTimeout(Duration.ofSeconds(10))
                .build()
    }
}
