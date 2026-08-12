package ai.antop.gunpla.onsale.repository

import ai.antop.gunpla.onsale.entity.OnSaleProduct
import org.springframework.data.jpa.repository.JpaRepository

interface OnSaleProductRepository : JpaRepository<OnSaleProduct, String> {
    fun findAllByOrderBySourceAscGradeAscNameAsc(): List<OnSaleProduct>
}
