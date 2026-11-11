package ai.antop.gunpla.user.repository

import ai.antop.gunpla.user.entity.UserProduct
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query

interface UserProductRepository : JpaRepository<UserProduct, Long> {
    // upsert 패턴에서 기존 행 조회 시 사용 (UserProductService.update 참조)
    fun findByUserIdAndProductId(
        userId: Long,
        productId: Long,
    ): UserProduct?

    fun findAllByUserId(userId: Long): List<UserProduct>

    // 사용자별 보유 제품 수 — 어드민 사용자 관리 목록(AdminUserService)에서 사용
    @Query("SELECT up.userId AS userId, COUNT(up) AS count FROM UserProduct up WHERE up.owned = true GROUP BY up.userId")
    fun countOwnedGroupByUserId(): List<UserOwnedCount>

    fun countByUserIdAndOwnedTrue(userId: Long): Long
}

interface UserOwnedCount {
    val userId: Long
    val count: Long
}
