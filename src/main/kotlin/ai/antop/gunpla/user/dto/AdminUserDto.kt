package ai.antop.gunpla.user.dto

import java.time.LocalDateTime

// 어드민 사용자 관리 목록 응답 — googleId 는 내부 식별자라 내려보내지 않는다
data class AdminUserResponseDto(
    val id: Long,
    val email: String?,
    val name: String?,
    val picture: String?,
    val ownedCount: Long,
    val notifyOnSale: Boolean,
    val shareEnabled: Boolean,
    val blocked: Boolean,
    val blockedAt: LocalDateTime?,
    val lastLoginAt: LocalDateTime?,
    val createdAt: LocalDateTime,
)
