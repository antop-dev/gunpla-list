package ai.antop.gunpla.user.repository

import ai.antop.gunpla.user.entity.UserAccount
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.JpaSpecificationExecutor

// JpaSpecificationExecutor: 어드민 사용자 관리 목록의 동적 검색/정렬(AdminUserService.search)에 사용
interface UserAccountRepository :
    JpaRepository<UserAccount, Long>,
    JpaSpecificationExecutor<UserAccount> {
    // Google OAuth2 "sub" 클레임으로 계정 조회 — OAuthUserService 및 UserProductService 에서 사용
    fun findByGoogleId(googleId: String): UserAccount?

    // 신규 판매제품 알림 수신 동의자 조회 (차단된 사용자 제외) — OnSaleNotificationService 에서 사용
    fun findAllByNotifyOnSaleTrueAndBlockedFalse(): List<UserAccount>

    // 차단 여부 확인 — BlockedUserFilter 가 로그인된 요청마다 호출
    fun existsByGoogleIdAndBlockedTrue(googleId: String): Boolean

    // 공유 페이지(/share/{shareId}) 조회 — SharePageController 에서 사용
    fun findByShareId(shareId: String): UserAccount?

    fun existsByShareId(shareId: String): Boolean
}
