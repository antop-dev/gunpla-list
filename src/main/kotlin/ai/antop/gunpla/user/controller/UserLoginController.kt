package ai.antop.gunpla.user.controller

import jakarta.servlet.http.HttpSession
import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestParam

// 헤더의 Google 로그인 버튼 진입점 — 로그인 후 돌아올 페이지(redirect)를 세션에 남기고 Google 로그인으로 넘긴다
// 로그인 성공 시 SecurityConfig 의 성공 핸들러가 이 값을 꺼내 해당 페이지로 보낸다 (없거나 잘못된 값이면 "/")
@Controller
class UserLoginController {
    @GetMapping("/login/google")
    fun login(
        @RequestParam(required = false) redirect: String?,
        session: HttpSession,
    ): String {
        val target = redirect?.takeIf { isSafeRedirect(it) }
        if (target == null) {
            session.removeAttribute(LOGIN_REDIRECT_ATTR)
        } else {
            session.setAttribute(LOGIN_REDIRECT_ATTR, target)
        }
        return "redirect:/oauth2/authorization/google"
    }

    companion object {
        const val LOGIN_REDIRECT_ATTR = "LOGIN_REDIRECT"

        // 오픈 리다이렉트 방지 — 이 사이트 안의 경로("/..." 이면서 "//", "/\" 로 시작하지 않음)만 허용
        fun isSafeRedirect(path: String): Boolean = path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\")
    }
}
