package ia.antop.gunpla.user.repository

import ia.antop.gunpla.user.entity.UserProduct
import org.springframework.data.jpa.repository.JpaRepository

interface UserProductRepository : JpaRepository<UserProduct, Long> {
    // upsert 패턴에서 기존 행 조회 시 사용 (UserProductService.update 참조)
    fun findByUserIdAndProductId(
        userId: Long,
        productId: Long,
    ): UserProduct?

    fun findAllByUserId(userId: Long): List<UserProduct>
}
