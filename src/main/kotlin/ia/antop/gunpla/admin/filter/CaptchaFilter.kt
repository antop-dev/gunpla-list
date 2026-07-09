package ia.antop.gunpla.admin.filter

import ia.antop.gunpla.common.config.CageProperties
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.web.filter.OncePerRequestFilter

// UsernamePasswordAuthenticationFilter 앞에 등록되어 Spring Security 인증보다 먼저 실행됨
class CaptchaFilter(
    private val cageProperties: CageProperties,
) : OncePerRequestFilter() {
    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        if (request.method == "POST" && request.servletPath == "/admin/login") {
            val sessionKey = cageProperties.sessionKey
            val sessionToken = request.session.getAttribute(sessionKey) as? String
            val inputToken = request.getParameter("captcha") ?: ""
            // 한 번 검증한 토큰은 즉시 제거 — 재사용(리플레이) 방지
            request.session.removeAttribute(sessionKey)

            if (sessionToken == null || !sessionToken.equals(inputToken, ignoreCase = true)) {
                // 자격증명 오류(?error)와 구분하기 위해 별도 파라미터로 리다이렉트
                response.sendRedirect(request.contextPath + "/admin/login?captchaError")
                return
            }
        }
        filterChain.doFilter(request, response)
    }
}
