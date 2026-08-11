package ai.antop.gunpla.onsale.controller

import ai.antop.gunpla.common.config.AppProperties
import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.ModelAttribute

// 판매제품 모아보기 페이지 — 로그인 불필요, 사용자 사이트 소속 공개 페이지 (/on-sale)
@Controller
class OnSalePageController(
    private val appProperties: AppProperties,
) {
    @ModelAttribute("ga4")
    fun ga4(): String? = appProperties.ga4

    @ModelAttribute("gtmId")
    fun gtmId(): String? = appProperties.gtmId

    @GetMapping("/on-sale")
    fun page() = "on-sale"
}
