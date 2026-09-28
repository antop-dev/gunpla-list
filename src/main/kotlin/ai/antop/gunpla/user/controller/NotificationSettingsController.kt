package ai.antop.gunpla.user.controller

import ai.antop.gunpla.common.exception.UnauthorizedException
import ai.antop.gunpla.user.dto.NotificationSettingsDto
import ai.antop.gunpla.user.dto.NotificationSettingsUpdateRequestDto
import ai.antop.gunpla.user.service.NotificationSettingsService
import org.springframework.security.core.Authentication
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

// 로그인한 사용자의 신규 판매제품 이메일 알림 설정 조회/수정 API (/api/user/notification-settings)
@RestController
@RequestMapping("/api/user/notification-settings")
class NotificationSettingsController(
    private val notificationSettingsService: NotificationSettingsService,
) {
    // OAuth2AuthenticationToken 의 "sub" 속성이 Google 계정의 고유 ID
    // 미인증이거나 OAuth2 토큰이 아니면 401 던짐
    private fun Authentication?.googleId(): String =
        (this as? OAuth2AuthenticationToken)?.principal?.getAttribute<String>("sub")
            ?: throw UnauthorizedException()

    @GetMapping
    fun get(authentication: Authentication?): NotificationSettingsDto = notificationSettingsService.get(authentication.googleId())

    @PutMapping
    fun update(
        authentication: Authentication?,
        @RequestBody request: NotificationSettingsUpdateRequestDto,
    ): NotificationSettingsDto = notificationSettingsService.update(authentication.googleId(), request)
}
