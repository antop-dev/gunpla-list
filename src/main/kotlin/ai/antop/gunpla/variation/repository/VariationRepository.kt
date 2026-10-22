package ai.antop.gunpla.variation.repository

import ai.antop.gunpla.variation.entity.Variation
import org.springframework.data.jpa.repository.JpaRepository

interface VariationRepository : JpaRepository<Variation, String> {
    fun findAllByOrderByNameAsc(): List<Variation>
}
