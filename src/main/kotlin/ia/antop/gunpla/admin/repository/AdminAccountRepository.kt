package ia.antop.gunpla.admin.repository

import ia.antop.gunpla.admin.entity.AdminAccount
import org.springframework.data.jpa.repository.JpaRepository

interface AdminAccountRepository : JpaRepository<AdminAccount, Long> {
    fun findByUsername(username: String): AdminAccount?
}
