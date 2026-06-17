package ia.antop.gunpla.admin.service

import ia.antop.gunpla.admin.repository.AdminAccountRepository
import ia.antop.gunpla.common.exception.BadRequestException
import org.springframework.security.core.userdetails.User
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.security.core.userdetails.UserDetailsService
import org.springframework.security.core.userdetails.UsernameNotFoundException
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class AdminAccountService(
    private val adminAccountRepository: AdminAccountRepository,
    private val passwordEncoder: PasswordEncoder,
) : UserDetailsService {
    @Transactional(readOnly = true)
    override fun loadUserByUsername(username: String): UserDetails {
        val admin =
            adminAccountRepository.findByUsername(username)
                ?: throw UsernameNotFoundException("Admin not found: $username")
        return User
            .builder()
            .username(admin.username)
            .password(admin.password)
            .roles("ADMIN")
            .build()
    }

    @Transactional
    fun changePassword(
        username: String,
        currentPassword: String,
        newPassword: String,
    ) {
        val admin =
            adminAccountRepository.findByUsername(username)
                ?: throw UsernameNotFoundException("Admin not found: $username")
        if (!passwordEncoder.matches(currentPassword, admin.password)) {
            throw BadRequestException("현재 비밀번호가 올바르지 않습니다.")
        }
        if (newPassword.length < 4) {
            throw BadRequestException("새 비밀번호는 4자 이상이어야 합니다.")
        }
        admin.password = passwordEncoder.encode(newPassword)!!
    }
}
