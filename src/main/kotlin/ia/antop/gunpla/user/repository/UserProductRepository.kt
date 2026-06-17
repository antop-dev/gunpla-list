package ia.antop.gunpla.user.repository

import ia.antop.gunpla.user.entity.UserProduct
import org.springframework.data.jpa.repository.JpaRepository

interface UserProductRepository : JpaRepository<UserProduct, Long> {
    fun findByUserIdAndProductId(
        userId: Long,
        productId: Long,
    ): UserProduct?

    fun findAllByUserId(userId: Long): List<UserProduct>
}
