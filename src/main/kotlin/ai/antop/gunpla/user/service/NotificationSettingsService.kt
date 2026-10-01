package ai.antop.gunpla.user.service

import ai.antop.gunpla.common.exception.BadRequestException
import ai.antop.gunpla.common.exception.NotFoundException
import ai.antop.gunpla.user.dto.NotificationSettingsDto
import ai.antop.gunpla.user.dto.NotificationSettingsUpdateRequestDto
import ai.antop.gunpla.user.entity.UserAccount
import ai.antop.gunpla.user.repository.UserAccountRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

// 사용자별 신규 판매제품 이메일 알림 설정 조회/수정
@Service
class NotificationSettingsService(
    private val userAccountRepository: UserAccountRepository,
) {
    @Transactional(readOnly = true)
    fun get(googleId: String): NotificationSettingsDto {
        val user = userAccountRepository.findByGoogleId(googleId) ?: throw NotFoundException("User not found")
        return user.toDto()
    }

    @Transactional
    fun update(
        googleId: String,
        request: NotificationSettingsUpdateRequestDto,
    ): NotificationSettingsDto {
        val user = userAccountRepository.findByGoogleId(googleId) ?: throw NotFoundException("User not found")

        val email = request.notifyEmail.trim()
        if (request.notifyOnSale && !EMAIL_PATTERN.matches(email)) {
            throw BadRequestException("올바른 이메일 주소를 입력하세요")
        }

        val grades =
            request.notifyGrades
                .map { it.trim().uppercase() }
                .filter { it.isNotBlank() }
                .distinct()
        if (grades.any { it !in NOTIFY_GRADES }) {
            throw BadRequestException("알 수 없는 등급이 포함되어 있습니다")
        }
        if (request.notifyOnSale && grades.isEmpty()) {
            throw BadRequestException("알림 받을 등급을 하나 이상 선택하세요")
        }

        user.notifyOnSale = request.notifyOnSale
        user.notifyEmail = email.ifBlank { null }
        // 표시 순서를 일정하게 유지하려고 등급 목록 순서대로 저장
        user.notifyGrades = NOTIFY_GRADES.filter { it in grades }

        return user.toDto()
    }

    // 저장된 알림 이메일이 없으면 구글 로그인 이메일을 기본값으로 보여준다
    private fun UserAccount.toDto() =
        NotificationSettingsDto(
            notifyOnSale = notifyOnSale,
            notifyEmail = notifyEmail?.ifBlank { null } ?: email.orEmpty(),
            notifyGrades = notifyGrades,
        )

    companion object {
        private val EMAIL_PATTERN = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")

        // 알림 설정에서 고를 수 있는 등급 — 판매제품 스크래퍼들이 파싱하는 등급과 같다(user.html 옵션과 맞춘다)
        private val NOTIFY_GRADES = listOf("HG", "RG", "MG", "MGSD", "MGEX", "PG")
    }
}
