package ia.antop.gunpla.product.controller

import ia.antop.gunpla.product.dto.ProductResponseDto
import ia.antop.gunpla.product.service.ProductService
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/products")
class ProductViewController(
    private val productService: ProductService,
) {
    @GetMapping
    fun search(
        @RequestParam(required = false) name: String?,
        @RequestParam(required = false) grade: String?,
        @RequestParam(required = false) modelNumber: String?,
        @RequestParam(required = false) categoryId: Long?,
        @RequestParam(required = false) keyword: String?,
    ): List<ProductResponseDto> = productService.search(name, grade, modelNumber, categoryId, keyword)
}
