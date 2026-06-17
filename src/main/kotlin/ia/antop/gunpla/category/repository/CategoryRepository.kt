package ia.antop.gunpla.category.repository

import ia.antop.gunpla.category.entity.Category
import org.springframework.data.jpa.repository.JpaRepository

interface CategoryRepository : JpaRepository<Category, Long> {
    fun existsByName(name: String): Boolean

    fun findAllByOrderBySortOrderAscNameAsc(): List<Category>

    fun findAllByIdIn(ids: Collection<Long>): List<Category>
}
