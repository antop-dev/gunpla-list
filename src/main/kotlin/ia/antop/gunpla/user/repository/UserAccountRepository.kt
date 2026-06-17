package ia.antop.gunpla.user.repository

import ia.antop.gunpla.user.entity.UserAccount
import org.springframework.data.jpa.repository.JpaRepository

interface UserAccountRepository : JpaRepository<UserAccount, Long> {
    // Google OAuth2 "sub" 클레임으로 계정 조회 — OAuthUserService 및 UserProductService 에서 사용
    fun findByGoogleId(googleId: String): UserAccount?
}
