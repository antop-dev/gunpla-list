package ia.antop.gunpla.category.repository

import ia.antop.gunpla.category.entity.Category
import org.springframework.data.jpa.repository.JpaRepository

interface CategoryRepository : JpaRepository<Category, Long> {
    // 카테고리 생성 시 이름 중복 확인
    fun existsByName(name: String): Boolean

    // 어드민/사용자 뷰 모두 sortOrder → name 순으로 정렬하여 일관된 순서 제공
    fun findAllByOrderBySortOrderAscNameAsc(): List<Category>

    // ProductService.search 에서 N+1 없이 카테고리 Map 을 일괄 조회할 때 사용
    fun findAllByIdIn(ids: Collection<Long>): List<Category>
}
