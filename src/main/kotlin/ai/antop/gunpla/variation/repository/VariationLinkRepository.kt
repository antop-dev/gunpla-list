package ai.antop.gunpla.variation.repository

import ai.antop.gunpla.variation.entity.VariationLink
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query

interface VariationLinkRepository : JpaRepository<VariationLink, String> {
    fun findAllByVariationId(variationId: String): List<VariationLink>

    // VariationNodeRepository.deleteAllByVariationId 와 같은 이유로 JPQL 로 즉시 삭제한다
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("DELETE FROM VariationLink l WHERE l.variationId = :variationId")
    fun deleteAllByVariationId(variationId: String)
}
