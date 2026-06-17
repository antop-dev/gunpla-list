package ia.antop.gunpla.user.repository

import ia.antop.gunpla.user.entity.UserAccount
import org.springframework.data.jpa.repository.JpaRepository

interface UserAccountRepository : JpaRepository<UserAccount, Long> {
    fun findByGoogleId(googleId: String): UserAccount?
}
