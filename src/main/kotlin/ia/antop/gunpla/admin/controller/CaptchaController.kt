package ia.antop.gunpla.admin.controller

import com.github.cage.Cage
import ia.antop.gunpla.common.config.CageProperties
import jakarta.servlet.http.HttpServletResponse
import jakarta.servlet.http.HttpSession
import org.springframework.http.HttpHeaders
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController
import java.io.ByteArrayOutputStream

@RestController
class CaptchaController(
    private val cageProperties: CageProperties,
    private val cage: Cage,
) {
    @GetMapping("/admin/captcha")
    fun captcha(
        session: HttpSession,
        resp: HttpServletResponse,
    ): ByteArray {
        val token = cage.tokenGenerator.next()
        // 토큰을 세션에 저장 — CaptchaFilter 가 로그인 요청 시 꺼내 비교
        session.setAttribute(cageProperties.sessionKey, token)

        // cage.format 에 맞는 Content-Type 설정 (GCage 기본값 = jpeg)
        resp.contentType = "image/" + cage.format
        // 브라우저가 이전 이미지를 캐싱하면 새로고침해도 동일 토큰이 표시되므로 캐시 금지
        resp.setHeader(HttpHeaders.CACHE_CONTROL, "no-cache, no-store")
        resp.setHeader(HttpHeaders.PRAGMA, "no-cache")
        val time = System.currentTimeMillis()
        resp.setDateHeader(HttpHeaders.LAST_MODIFIED, time)
        resp.setDateHeader(HttpHeaders.DATE, time)
        resp.setDateHeader(HttpHeaders.EXPIRES, time)

        return ByteArrayOutputStream().also { cage.draw(token, it) }.toByteArray()
    }
}
