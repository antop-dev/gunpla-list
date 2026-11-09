package ai.antop.gunpla.variation.repository

import ai.antop.gunpla.variation.entity.VariationNode
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query

interface VariationNodeRepository : JpaRepository<VariationNode, String> {
    fun findAllByVariationId(variationId: String): List<VariationNode>

    // 제품 하나가 여러 보드에 올라갈 수 있다
    fun findAllByProductId(productId: Long): List<VariationNode>

    fun findFirstByProductId(productId: Long): VariationNode?

    fun findAllByProductIdIn(productIds: Collection<Long>): List<VariationNode>

    // 보드 저장은 카드 전체를 갈아끼우는 방식 — 파생 delete 는 INSERT 뒤에 flush 되어 (variation_id, product_id) UNIQUE 와 충돌하므로 JPQL 로 즉시 삭제한다
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("DELETE FROM VariationNode n WHERE n.variationId = :variationId")
    fun deleteAllByVariationId(variationId: String)
}
