package ia.antop.gunpla.product.repository

import ia.antop.gunpla.product.entity.Product
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query

interface ProductRepository : JpaRepository<Product, Long> {
    // keyword 는 name/modelNumber 를 모두 검색하는 통합 키워드, name 은 제품명 전용 파라미터
    // LOWER() + LIKE 를 사용하는 이유: SQLite 기본 LIKE 는 ASCII 만 대소문자 무시하므로 명시적으로 LOWER() 적용
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

    // 카테고리 삭제 전 사용 중인 제품이 있는지 확인 (소프트 딜리트된 제품은 제외)
    fun existsByCategoryIdAndDeletedFalse(categoryId: Long): Boolean
}
