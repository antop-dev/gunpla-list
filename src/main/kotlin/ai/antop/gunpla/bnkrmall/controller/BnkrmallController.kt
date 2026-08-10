package ai.antop.gunpla.bnkrmall.controller

import ai.antop.gunpla.bnkrmall.dto.BnkrmallProductDto
import ai.antop.gunpla.bnkrmall.service.BnkrmallScraperService
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

// 반다이남코코리아몰 건프라 목록 API — /api/admin/bnkrmall-products (어드민 필터체인, ROLE_ADMIN 필요)
@RestController
@RequestMapping("/api/admin/bnkrmall-products")
class BnkrmallController(
    private val bnkrmallScraperService: BnkrmallScraperService,
) {
    @GetMapping
    fun search(): List<BnkrmallProductDto> = bnkrmallScraperService.scrapeAll()
}
