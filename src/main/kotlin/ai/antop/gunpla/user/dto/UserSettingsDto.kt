package ai.antop.gunpla.user.dto

import ai.antop.gunpla.product.dto.ProductResponseDto

// 사용자 설정 응답 DTO — 설정 팝업의 영역(프로필, 보유상품 공유, 신규 판매제품 알림)별로 나눠 담는다
data class UserSettingsDto(
    val profile: ProfileSettingsDto,
    val share: ShareSettingsDto,
    val notification: NotificationSettingsDto,
)

// 프로필 설정 — nicknameRequired 가 true 면 아직 닉네임을 정하지 않은 신규 사용자이고,
// 이때 nickname 에는 기본값으로 구글 이름이 채워진다
data class ProfileSettingsDto(
    val nickname: String,
    val nicknameRequired: Boolean,
)

// 보유상품 공유 설정 — shareUrl 은 공유를 허용한 경우에만 채워진다
data class ShareSettingsDto(
    val enabled: Boolean,
    val shareUrl: String?,
)

// 공유 페이지(/share/{shareId}) 응답 DTO — nickname 은 닉네임을 정하지 않은 경우 null
data class SharePageDto(
    val nickname: String?,
    val products: List<ProductResponseDto>,
)

// 사용자 설정 저장 요청 DTO
data class UserSettingsUpdateRequestDto(
    val profile: ProfileSettingsUpdateRequestDto,
    val share: ShareSettingsUpdateRequestDto,
    val notification: NotificationSettingsUpdateRequestDto,
)

data class ShareSettingsUpdateRequestDto(
    val enabled: Boolean,
)

// 닉네임 저장 요청 DTO — 설정 팝업과 로그인 후 닉네임 설정 팝업이 같이 쓴다
data class ProfileSettingsUpdateRequestDto(
    val nickname: String,
)
