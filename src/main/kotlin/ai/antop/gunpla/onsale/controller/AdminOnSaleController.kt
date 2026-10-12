package ai.antop.gunpla.onsale.controller

import ai.antop.gunpla.onsale.dto.OnSaleScrapeLogDto
import ai.antop.gunpla.onsale.dto.OnSaleScrapeStatusResponseDto
import ai.antop.gunpla.onsale.service.OnSaleScrapeStatusService
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

// 판매제품 수집 상태 API — 어드민 대시보드의 출처별 수집 상태 카드/이력 팝업에서 사용 (어드민 필터체인, ROLE_ADMIN 필요)
@RestController
@RequestMapping("/api/admin/on-sale")
class AdminOnSaleController(
    private val onSaleScrapeStatusService: OnSaleScrapeStatusService,
) {
    @GetMapping("/status")
    fun status(): OnSaleScrapeStatusResponseDto = onSaleScrapeStatusService.status()

    @GetMapping("/logs")
    fun logs(
        @RequestParam source: String,
    ): List<OnSaleScrapeLogDto> = onSaleScrapeStatusService.logs(source)
}
