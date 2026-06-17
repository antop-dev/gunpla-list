package ia.antop.gunpla.category.controller

import ia.antop.gunpla.category.dto.CategoryResponseDto
import ia.antop.gunpla.category.service.CategoryService
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/categories")
class PublicCategoryController(
    private val categoryService: CategoryService,
) {
    @GetMapping
    fun getAll(): List<CategoryResponseDto> = categoryService.getAll()
}
