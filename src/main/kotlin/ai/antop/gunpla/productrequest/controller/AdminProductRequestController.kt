package ai.antop.gunpla.productrequest.controller

import ai.antop.gunpla.productrequest.dto.ProductRequestApproveRequestDto
import ai.antop.gunpla.productrequest.dto.ProductRequestPendingCountDto
import ai.antop.gunpla.productrequest.dto.ProductRequestRejectRequestDto
import ai.antop.gunpla.productrequest.dto.ProductRequestResponseDto
import ai.antop.gunpla.productrequest.entity.ProductRequestStatus
import ai.antop.gunpla.productrequest.service.ProductRequestService
import org.springframework.security.core.Authentication
import org.springframework.web.bind.annotation.*

// 제품 등록/수정 요청 처리 API — /api/admin/product-requests (어드민 필터체인, ROLE_ADMIN 필요)
@RestController
@RequestMapping("/api/admin/product-requests")
class AdminProductRequestController(
    private val productRequestService: ProductRequestService,
) {
    @GetMapping
    fun findAll(
        @RequestParam(required = false) status: ProductRequestStatus?,
    ): List<ProductRequestResponseDto> = productRequestService.findAll(status)

    @GetMapping("/pending-count")
    fun pendingCount(): ProductRequestPendingCountDto = ProductRequestPendingCountDto(productRequestService.countPending())

    @GetMapping("/{id}")
    fun get(
        @PathVariable id: Long,
    ): ProductRequestResponseDto = productRequestService.get(id)

    // 승인 — 요청 내용을 관리자가 보정한 뒤 저장할 수 있으므로 본문으로 최종 값을 받는다
    @PostMapping("/{id}/approve")
    fun approve(
        authentication: Authentication,
        @PathVariable id: Long,
        @RequestBody request: ProductRequestApproveRequestDto,
    ): ProductRequestResponseDto = productRequestService.approve(id, authentication.name, request)

    @PostMapping("/{id}/reject")
    fun reject(
        authentication: Authentication,
        @PathVariable id: Long,
        @RequestBody request: ProductRequestRejectRequestDto,
    ): ProductRequestResponseDto = productRequestService.reject(id, authentication.name, request.reason)
}
