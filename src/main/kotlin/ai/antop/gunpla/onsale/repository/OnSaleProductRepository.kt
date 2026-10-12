package ai.antop.gunpla.onsale.repository

import ai.antop.gunpla.onsale.entity.OnSaleProduct
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query

interface OnSaleProductRepository : JpaRepository<OnSaleProduct, String> {
    fun findAllByOrderBySourceAscGradeAscNameAsc(): List<OnSaleProduct>

    // 출처별 적재 건수 — [source, count]
    @Query("select p.source, count(p) from OnSaleProduct p group by p.source")
    fun countGroupBySource(): List<Array<Any>>
}
