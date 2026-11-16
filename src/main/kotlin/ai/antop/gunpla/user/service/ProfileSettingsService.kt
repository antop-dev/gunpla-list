package ai.antop.gunpla.user.service

import ai.antop.gunpla.common.exception.BadRequestException
import ai.antop.gunpla.common.exception.NotFoundException
import ai.antop.gunpla.user.dto.ProfileSettingsDto
import ai.antop.gunpla.user.dto.ProfileSettingsUpdateRequestDto
import ai.antop.gunpla.user.entity.UserAccount
import ai.antop.gunpla.user.repository.UserAccountRepository
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

// 사용자 닉네임 조회/수정 — 닉네임이 없는(null) 신규 사용자는 로그인 후 닉네임 설정 팝업에서 정하거나 건너뛴다
@Service
class ProfileSettingsService(
    private val userAccountRepository: UserAccountRepository,
) {
    private val log = LoggerFactory.getLogger(this::class.java)

    @Transactional(readOnly = true)
    fun get(googleId: String): ProfileSettingsDto = findUser(googleId).toDto()

    @Transactional
    fun update(
        googleId: String,
        request: ProfileSettingsUpdateRequestDto,
    ): ProfileSettingsDto {
        val nickname = request.nickname.trim()
        if (nickname.isEmpty()) {
            throw BadRequestException("닉네임을 입력하세요")
        }
        if (nickname.length > NICKNAME_MAX_LENGTH) {
            throw BadRequestException("닉네임은 ${NICKNAME_MAX_LENGTH}자 이하로 입력하세요")
        }
        val user = findUser(googleId)
        user.nickname = nickname
        return user.toDto()
    }

    // 닉네임 설정 팝업의 "건너뛰기" — 구글 이름을 그대로 닉네임으로 쓴다
    @Transactional
    fun skip(googleId: String): ProfileSettingsDto {
        val user = findUser(googleId)
        if (user.nickname == null) {
            user.nickname = user.defaultNickname()
            log.info("Nickname skipped. userId={}", user.id)
        }
        return user.toDto()
    }

    private fun findUser(googleId: String): UserAccount =
        userAccountRepository.findByGoogleId(googleId) ?: throw NotFoundException("User not found")

    // 구글 이름이 없거나 너무 길면 잘라서 쓴다
    private fun UserAccount.defaultNickname(): String = name?.trim()?.take(NICKNAME_MAX_LENGTH).orEmpty()

    private fun UserAccount.toDto() =
        ProfileSettingsDto(
            nickname = nickname ?: defaultNickname(),
            nicknameRequired = nickname == null,
        )

    companion object {
        // user-header.html 의 닉네임 input maxlength 와 맞춘다
        const val NICKNAME_MAX_LENGTH = 20
    }
}
