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

        user.notifyOnSale = request.notifyOnSale
        user.notifyEmail = email.ifBlank { null }

        return user.toDto()
    }

    // 저장된 알림 이메일이 없으면 구글 로그인 이메일을 기본값으로 보여준다
    private fun UserAccount.toDto() =
        NotificationSettingsDto(
            notifyOnSale = notifyOnSale,
            notifyEmail = notifyEmail?.ifBlank { null } ?: email.orEmpty(),
        )

    companion object {
        private val EMAIL_PATTERN = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")
    }
}
