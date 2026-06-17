package ia.antop.gunpla.category.controller

import ia.antop.gunpla.category.dto.CategoryCreateRequestDto
import ia.antop.gunpla.category.dto.CategoryResponseDto
import ia.antop.gunpla.category.dto.CategoryUpdateRequestDto
import ia.antop.gunpla.category.service.CategoryService
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.*

// 카테고리 관리 API — /api/admin/categories (ROLE_ADMIN 필요)
@RestController
@RequestMapping("/api/admin/categories")
class CategoryController(
    private val categoryService: CategoryService,
) {
    @GetMapping
    fun getAll(): List<CategoryResponseDto> = categoryService.getAll()

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(
        @RequestBody request: CategoryCreateRequestDto,
    ): CategoryResponseDto = categoryService.create(request)

    @PutMapping("/{id}")
    fun update(
        @PathVariable id: Long,
        @RequestBody request: CategoryUpdateRequestDto,
    ): CategoryResponseDto = categoryService.update(id, request)

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(
        @PathVariable id: Long,
    ) = categoryService.delete(id)
}
