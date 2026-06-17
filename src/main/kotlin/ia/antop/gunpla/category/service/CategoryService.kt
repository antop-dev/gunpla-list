package ia.antop.gunpla.category.service

import ia.antop.gunpla.category.dto.CategoryCreateRequestDto
import ia.antop.gunpla.category.dto.CategoryResponseDto
import ia.antop.gunpla.category.dto.CategoryUpdateRequestDto
import ia.antop.gunpla.category.entity.Category
import ia.antop.gunpla.category.repository.CategoryRepository
import ia.antop.gunpla.common.exception.BadRequestException
import ia.antop.gunpla.common.exception.NotFoundException
import ia.antop.gunpla.product.repository.ProductRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class CategoryService(
    private val categoryRepository: CategoryRepository,
    private val productRepository: ProductRepository,
) {
    @Transactional(readOnly = true)
    fun getAll(): List<CategoryResponseDto> = categoryRepository.findAllByOrderBySortOrderAscNameAsc().map { it.toDto() }

    @Transactional
    fun create(request: CategoryCreateRequestDto): CategoryResponseDto {
        if (categoryRepository.existsByName(request.name)) {
            throw BadRequestException("Category '${request.name}' already exists")
        }
        val category = Category(name = request.name, color = request.color)
        return categoryRepository.save(category).toDto()
    }

    @Transactional
    fun update(
        id: Long,
        request: CategoryUpdateRequestDto,
    ): CategoryResponseDto {
        val category = categoryRepository.findById(id).orElseThrow { NotFoundException("Category not found: $id") }
        category.name = request.name
        category.color = request.color
        category.sortOrder = request.sortOrder
        return category.toDto()
    }

    @Transactional
    fun delete(id: Long) {
        if (!categoryRepository.existsById(id)) throw NotFoundException("Category not found: $id")
        if (productRepository.existsByCategoryIdAndDeletedFalse(id)) {
            throw BadRequestException("해당 구분을 사용 중인 제품이 있어 삭제할 수 없습니다.")
        }
        categoryRepository.deleteById(id)
    }

    private fun Category.toDto() =
        CategoryResponseDto(
            id = id!!,
            name = name,
            color = color,
            sortOrder = sortOrder,
        )
}
