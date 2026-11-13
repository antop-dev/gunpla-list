package ai.antop.gunpla.admin.service

import ai.antop.gunpla.admin.repository.AdminAccountRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.event.EventListener
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Component
import org.springframework.transaction.annotation.Transactional
import java.security.SecureRandom
import java.util.Base64

private val log = KotlinLogging.logger {}

// V5 마이그레이션이 넣는 기본 어드민 비밀번호(공개 저장소에 노출된 값)를 시작 시 바꿔 둔다
// ADMIN_INITIAL_PASSWORD 가 있으면 그 값으로, 없으면 난수 비밀번호를 만들어 로그에 한 번만 출력한다
// (기존 비밀번호를 이미 바꾼 계정은 건드리지 않는다)
@Component
class DefaultAdminPasswordInitializer(
    private val adminAccountRepository: AdminAccountRepository,
    private val passwordEncoder: PasswordEncoder,
    @Value("\${app.admin.initial-password:}") private val initialPassword: String,
) {
    @EventListener(ApplicationReadyEvent::class)
    @Transactional
    fun replaceDefaultPassword() {
        adminAccountRepository.findAll().filter { it.password == DEFAULT_PASSWORD }.forEach { admin ->
            val generated = initialPassword.isBlank()
            val password = initialPassword.ifBlank { generatePassword() }
            admin.password = passwordEncoder.encode(password)!!
            adminAccountRepository.save(admin)
            if (generated) {
                log.warn { "기본 어드민 비밀번호를 교체했습니다. username=${admin.username}, password=$password — 로그인 후 바로 변경하세요." }
            } else {
                log.warn { "기본 어드민 비밀번호를 ADMIN_INITIAL_PASSWORD 값으로 교체했습니다. username=${admin.username}" }
            }
        }
    }

    private fun generatePassword(): String =
        Base64.getUrlEncoder().withoutPadding().encodeToString(ByteArray(18).also { SecureRandom().nextBytes(it) })

    companion object {
        private const val DEFAULT_PASSWORD = "{noop}admin123"
    }
}
