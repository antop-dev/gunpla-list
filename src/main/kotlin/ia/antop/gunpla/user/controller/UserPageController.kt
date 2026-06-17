package ia.antop.gunpla.user.controller

import ia.antop.gunpla.common.config.AppProperties
import org.springframework.beans.factory.annotation.Value
import org.springframework.security.core.Authentication
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken
import org.springframework.stereotype.Controller
import org.springframework.ui.Model
import org.springframework.web.bind.annotation.GetMapping

@Controller
class UserPageController(
    private val appProperties: AppProperties,
    @Value("\${server.servlet.context-path:}") private val contextPath: String,
) {
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
