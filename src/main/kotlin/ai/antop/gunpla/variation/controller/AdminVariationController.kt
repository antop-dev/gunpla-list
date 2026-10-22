package ai.antop.gunpla.variation.controller

import ai.antop.gunpla.variation.dto.VariationAssignmentDto
import ai.antop.gunpla.variation.dto.VariationCreateRequestDto
import ai.antop.gunpla.variation.dto.VariationResponseDto
import ai.antop.gunpla.variation.dto.VariationSaveRequestDto
import ai.antop.gunpla.variation.dto.VariationSummaryDto
import ai.antop.gunpla.variation.service.VariationService
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.*

// 바리에이션 구성도 보드 관리 API — /api/admin/variations (어드민 필터체인, ROLE_ADMIN 필요)
@RestController
@RequestMapping("/api/admin/variations")
class AdminVariationController(
    private val variationService: VariationService,
) {
    @GetMapping
    fun findAll(): List<VariationSummaryDto> = variationService.findAll()

    // 보드에 올라간 제품 전체 (제품 → 보드) — 제품 검색 목록에서 다른 보드의 제품을 구분하는 데 사용
    @GetMapping("/assignments")
    fun findAssignments(): List<VariationAssignmentDto> = variationService.findAssignments()

    @GetMapping("/{id}")
    fun get(
        @PathVariable id: String,
    ): VariationResponseDto = variationService.get(id)

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(
        @RequestBody request: VariationCreateRequestDto,
    ): VariationResponseDto = variationService.create(request)

    @PutMapping("/{id}")
    fun save(
        @PathVariable id: String,
        @RequestBody request: VariationSaveRequestDto,
    ): VariationResponseDto = variationService.save(id, request)

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(
        @PathVariable id: String,
    ) = variationService.delete(id)
}
