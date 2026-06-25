package ia.antop.gunpla.user.controller

import ia.antop.gunpla.common.config.AppProperties
import org.springframework.beans.factory.annotation.Value
import org.springframework.security.core.Authentication
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken
import org.springframework.stereotype.Controller
import org.springframework.ui.Model
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.ModelAttribute

@Controller
class UserPageController(
    private val appProperties: AppProperties,
    @Value("\${server.servlet.context-path:}") private val contextPath: String,
) {
    /** 모든 뷰에 GA4 측정 ID 주입 (미설정 시 null → 템플릿에서 GA4 비활성) */
    @ModelAttribute("ga4")
    fun ga4(): String? = appProperties.ga4

    /** 모든 뷰에 GTM ID 주입 (미설정 시 null → 템플릿에서 GTM 비활성) */
    @ModelAttribute("gtmId")
    fun gtmId(): String? = appProperties.gtmId

    @GetMapping("/")
    fun index(
        model: Model,
        authentication: Authentication?,
    ): String {
        if (authentication is OAuth2AuthenticationToken) {
            model.addAttribute("userPicture", authentication.principal.attributes["picture"] as? String)
            model.addAttribute("loggedIn", true)
        } else {
            model.addAttribute("loggedIn", false)
        }
        model.addAttribute("baseUrl", appProperties.baseUrl.trimEnd('/') + contextPath)
        return "user"
    }
}
