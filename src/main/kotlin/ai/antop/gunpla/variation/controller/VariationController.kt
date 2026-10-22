package ai.antop.gunpla.variation.controller

import ai.antop.gunpla.variation.dto.VariationResponseDto
import ai.antop.gunpla.variation.service.VariationService
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

// 사용자 구성도 팝업 API — 비로그인도 조회 가능 (/api/products/** 공개 경로)
@RestController
@RequestMapping("/api/products/{productId}/variation")
class VariationController(
    private val variationService: VariationService,
) {
    @GetMapping
    fun get(
        @PathVariable productId: Long,
    ): VariationResponseDto = variationService.getByProductId(productId)
}
