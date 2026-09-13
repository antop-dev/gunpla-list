package ai.antop.gunpla.productrelease.controller

import ai.antop.gunpla.productrelease.dto.ManualLinkDto
import ai.antop.gunpla.productrelease.dto.ProductReleaseResponseDto
import ai.antop.gunpla.productrelease.service.BandaiManualService
import ai.antop.gunpla.productrelease.service.ProductReleaseService
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

// 제품 출시 정보 API — /api/admin/product-release-info (어드민 필터체인, ROLE_ADMIN 필요)
@RestController
@RequestMapping("/api/admin/product-release-info")
class ProductReleaseController(
    private val productReleaseService: ProductReleaseService,
    private val bandaiManualService: BandaiManualService,
) {
    @GetMapping
    fun search(): List<ProductReleaseResponseDto> = productReleaseService.findProductReleases()

    // 이미지 팝업 전용 프록시 — 외부 이미지를 서버에서 받아와 흰 여백을 잘라낸 JPEG로 반환
    @GetMapping("/image")
    fun trimmedImage(
        @RequestParam url: String,
    ): ResponseEntity<ByteArray> {
        val trimmedImage = productReleaseService.fetchTrimmedImage(url)
        return ResponseEntity.ok().contentType(MediaType.IMAGE_JPEG).body(trimmedImage)
    }

    // 매뉴얼 조회 — 반다이 매뉴얼 상세 페이지를 파싱해 그 제품의 매뉴얼(PDF) 목록을 반환 (2개인 제품이 있음)
    // 행마다 외부 요청이 1회 발생하므로 그리드에서 관리자가 누른 행만 호출한다
    @GetMapping("/manuals")
    fun manuals(
        @RequestParam url: String,
    ): List<ManualLinkDto> = bandaiManualService.findManuals(url)

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
