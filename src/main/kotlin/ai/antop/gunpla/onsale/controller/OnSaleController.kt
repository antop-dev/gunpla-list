package ai.antop.gunpla.onsale.controller

import ai.antop.gunpla.onsale.dto.OnSaleProductDto
import ai.antop.gunpla.onsale.service.OnSaleService
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

// 판매제품 모아보기 API — /api/on-sale-products (사용자 필터체인, 로그인 불필요 공개 API)
@RestController
@RequestMapping("/api/on-sale-products")
class OnSaleController(
    private val onSaleService: OnSaleService,
) {
    @GetMapping
    fun search(): List<OnSaleProductDto> = onSaleService.findAll()
}
