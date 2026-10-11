package ai.antop.gunpla.user.service

import ai.antop.gunpla.user.dto.UserSettingsDto
import ai.antop.gunpla.user.dto.UserSettingsUpdateRequestDto
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

// 설정 팝업의 영역별 설정을 한 번에 조회/저장 — 한 영역이라도 검증에 실패하면 전체 저장이 롤백된다
@Service
class UserSettingsService(
    private val shareService: ShareService,
    private val notificationSettingsService: NotificationSettingsService,
) {
    @Transactional(readOnly = true)
    fun get(googleId: String): UserSettingsDto =
        UserSettingsDto(
            share = shareService.get(googleId),
            notification = notificationSettingsService.get(googleId),
        )

    @Transactional
    fun update(
        googleId: String,
        request: UserSettingsUpdateRequestDto,
    ): UserSettingsDto =
        UserSettingsDto(
            notification = notificationSettingsService.update(googleId, request.notification),
            share = shareService.update(googleId, request.share.enabled),
        )
}
