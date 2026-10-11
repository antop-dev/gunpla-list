package ai.antop.gunpla.user.controller

import ai.antop.gunpla.common.config.AppProperties
import ai.antop.gunpla.user.service.ShareService
import jakarta.servlet.http.HttpServletResponse
import org.springframework.stereotype.Controller
import org.springframework.ui.Model
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.ModelAttribute
import org.springframework.web.bind.annotation.PathVariable

// 보유상품 공유 페이지 — 로그인 불필요 공개 페이지 (/share/{shareId})
// 없는 공유 ID 이거나 공유를 끈 경우 404 와 함께 안내 화면을 보여준다
@Controller
class SharePageController(
    private val shareService: ShareService,
    private val appProperties: AppProperties,
) {
    @ModelAttribute("ga4")
    fun ga4(): String? = appProperties.ga4

    @ModelAttribute("gtmId")
    fun gtmId(): String? = appProperties.gtmId

    @GetMapping("/share/{shareId}")
    fun page(
        @PathVariable shareId: String,
        model: Model,
        response: HttpServletResponse,
    ): String {
        val products = shareService.findSharedProducts(shareId)
        if (products == null) {
            response.status = HttpServletResponse.SC_NOT_FOUND
        }
        model.addAttribute("products", products.orEmpty())
        model.addAttribute("shared", products != null)
        return "share"
    }
}
