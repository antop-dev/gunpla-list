package ai.antop.gunpla.user.filter

import ai.antop.gunpla.user.service.AdminUserService
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler
import org.springframework.web.filter.OncePerRequestFilter

// 로그인된 상태에서 차단된 사용자를 다음 요청에서 로그아웃시킨다 (로그인 자체는 OAuthUserService 가 막는다)
// 로그아웃 후에는 비로그인 요청으로 계속 진행되므로 /api/user/** 는 401, 공개 페이지는 비로그인 화면이 된다
class BlockedUserFilter(
    private val adminUserService: AdminUserService,
) : OncePerRequestFilter() {
    // 세션 무효화는 하지 않는다 — 같은 세션의 어드민 로그인까지 끊기지 않도록 (SecurityConfig 의 logout 설정과 동일)
    private val logoutHandler = SecurityContextLogoutHandler().apply { isInvalidateHttpSession = false }

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        val authentication = SecurityContextHolder.getContext().authentication as? OAuth2AuthenticationToken
        val googleId = authentication?.principal?.getAttribute<String>("sub")
        if (googleId != null && adminUserService.isBlocked(googleId)) {
            logoutHandler.logout(request, response, authentication)
        }
        filterChain.doFilter(request, response)
    }
}
