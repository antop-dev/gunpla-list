package ai.antop.gunpla.product.repository

import ai.antop.gunpla.product.entity.ProductBoxArt
import org.springframework.data.jpa.repository.JpaRepository

interface ProductBoxArtRepository : JpaRepository<ProductBoxArt, Long> {
    fun findAllByProductIdOrderBySortOrderAscIdAsc(productId: Long): List<ProductBoxArt>

    fun findAllByProductIdInOrderBySortOrderAscIdAsc(productIds: Collection<Long>): List<ProductBoxArt>

    // 제품 목록 전체를 그릴 때 사용 — IN 절 대신 전체를 읽는다 (SQLite 바인딩 변수 개수 제한 회피)
    fun findAllByOrderBySortOrderAscIdAsc(): List<ProductBoxArt>

    fun findFirstByProductIdOrderBySortOrderAscIdAsc(productId: Long): ProductBoxArt?
}
