package ia.antop.gunpla.admin.repository

import ia.antop.gunpla.admin.entity.AdminAccount
import org.springframework.data.jpa.repository.JpaRepository

interface AdminAccountRepository : JpaRepository<AdminAccount, Long> {
    // Spring Security UserDetailsService 및 비밀번호 변경 시 username 으로 계정 조회
    fun findByUsername(username: String): AdminAccount?
}
