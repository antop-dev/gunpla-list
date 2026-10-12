package ai.antop.gunpla.onsale.controller

import ai.antop.gunpla.common.exception.UnauthorizedException
import ai.antop.gunpla.onsale.dto.OnSaleAlertResponseDto
import ai.antop.gunpla.onsale.dto.OnSaleAlertUpdateRequestDto
import ai.antop.gunpla.onsale.service.OnSaleAlertService
import org.springframework.security.core.Authentication
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

// 로그인한 사용자의 판매제품 제품별 알림 조회/일괄 변경 API (/api/user/on-sale-alerts)
@RestController
@RequestMapping("/api/user/on-sale-alerts")
class UserOnSaleAlertController(
    private val onSaleAlertService: OnSaleAlertService,
) {
    // OAuth2AuthenticationToken 의 "sub" 속성이 Google 계정의 고유 ID
    // 미인증이거나 OAuth2 토큰이 아니면 401 던짐
    private fun Authentication?.googleId(): String =
        (this as? OAuth2AuthenticationToken)?.principal?.getAttribute<String>("sub")
            ?: throw UnauthorizedException()

    @GetMapping
    fun get(authentication: Authentication?): OnSaleAlertResponseDto = onSaleAlertService.get(authentication.googleId())

    @PutMapping
    fun update(
        authentication: Authentication?,
        @RequestBody request: OnSaleAlertUpdateRequestDto,
    ): OnSaleAlertResponseDto = onSaleAlertService.update(authentication.googleId(), request)
}
