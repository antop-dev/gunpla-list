package ia.antop.gunpla.admin.service

import ia.antop.gunpla.admin.repository.AdminAccountRepository
import org.springframework.security.core.userdetails.User
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.security.core.userdetails.UserDetailsService
import org.springframework.security.core.userdetails.UsernameNotFoundException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class AdminAccountService(
    private val adminAccountRepository: AdminAccountRepository,
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
}
