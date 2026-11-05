package ai.antop.gunpla.product.controller

import ai.antop.gunpla.product.dto.BoxArtOrderRequestDto
import ai.antop.gunpla.product.dto.BoxArtUrlRequestDto
import ai.antop.gunpla.product.dto.ProductCreateRequestDto
import ai.antop.gunpla.product.dto.ProductResponseDto
import ai.antop.gunpla.product.dto.ProductUpdateRequestDto
import ai.antop.gunpla.product.service.ProductService
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.*
import org.springframework.web.multipart.MultipartFile

// 제품 관리 API — /api/admin/products (어드민 필터체인, ROLE_ADMIN 필요)
@RestController
@RequestMapping("/api/admin/products")
class AdminProductController(
    private val productService: ProductService,
) {
    // 어드민 목록은 전체를 내려주고 화면(admin.js)에서 거르므로 검색 조건을 받지 않는다
    @GetMapping
    fun list(): List<ProductResponseDto> = productService.search()

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

    // 박스아트는 여러 장 등록할 수 있다 — 파일 업로드와 URL 입력 모두 기존 목록의 맨 뒤에 추가한다
    @PostMapping("/{id}/box-art")
    fun uploadBoxArt(
        @PathVariable id: Long,
        @RequestParam("file") file: MultipartFile,
    ): ProductResponseDto = productService.uploadBoxArt(id, file)

    @DeleteMapping("/{id}/box-art/{boxArtId}")
    fun deleteBoxArt(
        @PathVariable id: Long,
        @PathVariable boxArtId: Long,
    ): ProductResponseDto = productService.deleteBoxArt(id, boxArtId)

    @PutMapping("/{id}/box-art/order")
    fun reorderBoxArts(
        @PathVariable id: Long,
        @RequestBody request: BoxArtOrderRequestDto,
    ): ProductResponseDto = productService.reorderBoxArts(id, request.ids)

    @PutMapping("/{id}/box-art-url")
    fun updateBoxArtUrl(
        @PathVariable id: Long,
        @RequestBody request: BoxArtUrlRequestDto,
    ): ProductResponseDto = productService.updateBoxArtUrl(id, request.url)
}
