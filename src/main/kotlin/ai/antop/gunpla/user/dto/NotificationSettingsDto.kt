package ai.antop.gunpla.user.dto

// 알림 설정 응답 DTO — notifyEmail 은 저장된 값이 없으면 UserAccount.email(구글 이메일)을 기본값으로 채워 반환한다
// notifyGrades 가 비어 있으면 알림 메일을 보내지 않는다
data class NotificationSettingsDto(
    val notifyOnSale: Boolean,
    val notifyEmail: String,
    val notifyGrades: List<String>,
)

// 알림 설정 저장 요청 DTO
data class NotificationSettingsUpdateRequestDto(
    val notifyOnSale: Boolean,
    val notifyEmail: String,
    val notifyGrades: List<String> = emptyList(),
)
