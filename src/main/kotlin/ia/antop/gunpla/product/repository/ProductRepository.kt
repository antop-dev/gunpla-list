package ia.antop.gunpla.product.repository

import ia.antop.gunpla.product.entity.Product
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query

interface ProductRepository : JpaRepository<Product, Long> {
    @Query(
        """
        SELECT p FROM Product p
        WHERE p.deleted = false
          AND (:keyword IS NULL OR LOWER(p.name) LIKE LOWER(CONCAT('%', :keyword, '%'))
                                OR LOWER(p.modelNumber) LIKE LOWER(CONCAT('%', :keyword, '%')))
          AND (:name IS NULL OR LOWER(p.name) LIKE LOWER(CONCAT('%', :name, '%')))
          AND (:grade IS NULL OR p.grade = :grade)
          AND (:modelNumber IS NULL OR LOWER(p.modelNumber) LIKE LOWER(CONCAT('%', :modelNumber, '%')))
          AND (:categoryId IS NULL OR p.categoryId = :categoryId)
        ORDER BY p.createdAt DESC
        """,
    )
    fun search(
        keyword: String?,
        name: String?,
        grade: String?,
        modelNumber: String?,
        categoryId: Long?,
    ): List<Product>

    fun existsByCategoryIdAndDeletedFalse(categoryId: Long): Boolean
}
