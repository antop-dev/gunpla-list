package ai.antop.gunpla.productrelease.controller

import ai.antop.gunpla.productrelease.dto.ProductReleaseResponseDto
import ai.antop.gunpla.productrelease.service.ProductReleaseService
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

// 제품 출시 정보 API — /api/admin/product-release-info (어드민 필터체인, ROLE_ADMIN 필요)
@RestController
@RequestMapping("/api/admin/product-release-info")
class ProductReleaseController(
    private val productReleaseService: ProductReleaseService,
) {
    @GetMapping
    fun search(): List<ProductReleaseResponseDto> = productReleaseService.findProductReleases()

    @PutMapping("/check/{hash}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun check(
        @PathVariable hash: String,
    ) {
        productReleaseService.check(hash)
    }

    @DeleteMapping("/check/{hash}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun uncheck(
        @PathVariable hash: String,
    ) {
        productReleaseService.uncheck(hash)
    }
}
