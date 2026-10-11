package ai.antop.gunpla.user.dto

// 사용자 설정 응답 DTO — 설정 팝업의 영역(보유상품 공유, 신규 판매제품 알림)별로 나눠 담는다
data class UserSettingsDto(
    val share: ShareSettingsDto,
    val notification: NotificationSettingsDto,
)

// 보유상품 공유 설정 — shareUrl 은 공유를 허용한 경우에만 채워진다
data class ShareSettingsDto(
    val enabled: Boolean,
    val shareUrl: String?,
)

// 사용자 설정 저장 요청 DTO
data class UserSettingsUpdateRequestDto(
    val share: ShareSettingsUpdateRequestDto,
    val notification: NotificationSettingsUpdateRequestDto,
)

data class ShareSettingsUpdateRequestDto(
    val enabled: Boolean,
)
