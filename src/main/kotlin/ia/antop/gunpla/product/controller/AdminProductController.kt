package ia.antop.gunpla.product.controller

import ia.antop.gunpla.product.dto.BoxArtUrlRequestDto
import ia.antop.gunpla.product.dto.ProductCreateRequestDto
import ia.antop.gunpla.product.dto.ProductResponseDto
import ia.antop.gunpla.product.dto.ProductUpdateRequestDto
import ia.antop.gunpla.product.service.ProductService
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.*
import org.springframework.web.multipart.MultipartFile

// 제품 관리 API — /api/admin/products (어드민 필터체인, ROLE_ADMIN 필요)
@RestController
@RequestMapping("/api/admin/products")
class AdminProductController(
    private val productService: ProductService,
) {
    @GetMapping
    fun search(
        @RequestParam(required = false) name: String?,
        @RequestParam(required = false) grade: String?,
        @RequestParam(required = false) modelNumber: String?,
        @RequestParam(required = false) categoryId: Long?,
    ): List<ProductResponseDto> = productService.search(name, grade, modelNumber, categoryId)

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(
        @RequestBody request: ProductCreateRequestDto,
    ): ProductResponseDto = productService.create(request)

    @PutMapping("/{id}")
    fun update(
        @PathVariable id: Long,
        @RequestBody request: ProductUpdateRequestDto,
    ): ProductResponseDto = productService.update(id, request)

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(
        @PathVariable id: Long,
    ) = productService.delete(id)

    // 파일 업로드와 URL 입력 두 경로를 별도 엔드포인트로 분리 (admin.js 에서 파일이 있으면 파일 우선)
    @PostMapping("/{id}/box-art")
    fun uploadBoxArt(
        @PathVariable id: Long,
        @RequestParam("file") file: MultipartFile,
    ): ProductResponseDto = productService.uploadBoxArt(id, file)

    @DeleteMapping("/{id}/box-art")
    fun deleteBoxArt(
        @PathVariable id: Long,
    ): ProductResponseDto = productService.deleteBoxArt(id)

    @PutMapping("/{id}/box-art-url")
    fun updateBoxArtUrl(
        @PathVariable id: Long,
        @RequestBody request: BoxArtUrlRequestDto,
    ): ProductResponseDto = productService.updateBoxArtUrl(id, request.url)
}
