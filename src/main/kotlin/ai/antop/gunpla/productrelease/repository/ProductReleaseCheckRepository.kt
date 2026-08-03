package ai.antop.gunpla.productrelease.repository

import ai.antop.gunpla.productrelease.entity.ProductReleaseCheck
import org.springframework.data.jpa.repository.JpaRepository

interface ProductReleaseCheckRepository : JpaRepository<ProductReleaseCheck, Long> {
    fun existsByHash(hash: String): Boolean

    fun deleteByHash(hash: String)
}
