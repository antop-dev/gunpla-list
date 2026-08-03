package ai.antop.gunpla.category.controller

import ai.antop.gunpla.category.dto.CategoryResponseDto
import ai.antop.gunpla.category.service.CategoryService
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
