package ai.antop.gunpla.onsale.controller

import ai.antop.gunpla.common.config.AppProperties
import org.springframework.security.core.Authentication
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken
import org.springframework.stereotype.Controller
import org.springframework.ui.Model
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.ModelAttribute

// 판매제품 모아보기 페이지 — 로그인 불필요, 사용자 사이트 소속 공개 페이지 (/on-sale)
// 로그인한 사용자에게만 제품별 알림(체크박스 일괄 알림/해제, 알림 열)과 계정 메뉴(설정/공유/로그아웃)를 보여준다
@Controller
class OnSalePageController(
    private val appProperties: AppProperties,
) {
    @ModelAttribute("ga4")
    fun ga4(): String? = appProperties.ga4

    @ModelAttribute("gtmId")
    fun gtmId(): String? = appProperties.gtmId

    @GetMapping("/on-sale")
    fun page(
        model: Model,
        authentication: Authentication?,
    ): String {
        // 공통 헤더(fragments/user-header)가 쓰는 로그인 여부/프로필 이미지
        if (authentication is OAuth2AuthenticationToken) {
            model.addAttribute("loggedIn", true)
            model.addAttribute("userPicture", authentication.principal.attributes["picture"] as? String)
        } else {
            model.addAttribute("loggedIn", false)
        }
        return "on-sale"
    }
}
