package ai.antop.gunpla.productrelease.service

import ai.antop.gunpla.common.exception.BadRequestException
import ai.antop.gunpla.productrelease.dto.ManualLinkDto
import org.jsoup.Jsoup
import org.springframework.http.HttpHeaders
import org.springframework.stereotype.Service
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse.BodyHandlers
import java.time.Duration

// 반다이 WEB 취급설명서 상세 페이지(https://manual.bandai-hobby.net/menus/detail/{번호})에서 매뉴얼 목록을 수집
// 한 제품에 매뉴얼이 2개인 경우가 있다 — 첫 번째는 조립설명서(取扱説明書), 두 번째는 제품에 따라
// シール貼り指示(씰 부착 지시) / 補足説明書(보충) / 変形説明 등으로 라벨이 다르다
// PDF 는 /pdf/{번호}.pdf, 두 번째는 /pdf/{번호}_2.pdf 규칙이지만 존재 여부와 라벨은 상세 페이지에만 있어
// 매뉴얼 버튼(a.el_btn_manual)을 모두 읽는다 (라벨 안에 <br> 이 섞여 있어 Jsoup text() 로 평문화)
// 목록 조회 때 전체 행을 미리 확인하면 행당 1요청이 되어 과하므로, 그리드에서 관리자가 누른 행만 조회한다
@Service
class BandaiManualService {
    fun findManuals(detailUrl: String): List<ManualLinkDto> {
        if (!DETAIL_URL_PATTERN.matches(detailUrl)) {
            throw BadRequestException("반다이 매뉴얼 상세 URL 이 아닙니다: $detailUrl")
        }
        val manuals =
            fetchManualButtons(detailUrl).mapNotNull { element ->
                val file =
                    PDF_FILE_PATTERN
                        .find(element.attr("data-src"))
                        ?.groupValues
                        ?.get(1)
                        ?: return@mapNotNull null
                ManualLinkDto(
                    number = file,
                    label = element.text().trim(),
                    pdfUrl = "$PDF_URL_BASE/$file.pdf",
                )
            }
        return manuals
    }

    private fun fetchManualButtons(detailUrl: String) =
        Jsoup
            .parse(fetchText(detailUrl), detailUrl)
            .select(MANUAL_BUTTON_SELECTOR)

    private fun fetchText(url: String): String {
        val request =
            HttpRequest
                .newBuilder(URI(url))
                .header(HttpHeaders.USER_AGENT, USER_AGENT)
                .header(HttpHeaders.ACCEPT, "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                .header(HttpHeaders.ACCEPT_LANGUAGE, "ja,ko;q=0.9,en;q=0.8")
                .timeout(Duration.ofSeconds(20))
                .build()
        val response = HTTP_CLIENT.send(request, BodyHandlers.ofString())
        check(response.statusCode() == 200) {
            "bandai manual fetch failed: HTTP ${response.statusCode()} from $url"
        }
        return response.body()
    }

    companion object {
        private const val PDF_URL_BASE = "https://manual.bandai-hobby.net/pdf"
        private const val MANUAL_BUTTON_SELECTOR = "a.el_btn_manual"
        private const val USER_AGENT =
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"

        // 임의 주소를 서버가 받아오지 않도록 반다이 매뉴얼 상세 URL 만 허용
        private val DETAIL_URL_PATTERN = Regex("""^https?://manual\.bandai-hobby\.net/menus/detail/[\w-]+/?$""")

        // "/viewer.php?file=/pdf/1100_2.pdf&v=snnlpk" → "1100_2"
        private val PDF_FILE_PATTERN = Regex("""/pdf/([\w-]+)\.pdf""")

        private val HTTP_CLIENT: HttpClient =
            HttpClient
                .newBuilder()
                .followRedirects(HttpClient.Redirect.NORMAL)
                .connectTimeout(Duration.ofSeconds(10))
                .build()
    }
}
