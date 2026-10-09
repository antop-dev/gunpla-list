package ai.antop.gunpla.dashboard.controller

import ai.antop.gunpla.dashboard.dto.DashboardSummaryResponseDto
import ai.antop.gunpla.dashboard.dto.DashboardUserProductResponseDto
import ai.antop.gunpla.dashboard.dto.DashboardUserResponseDto
import ai.antop.gunpla.dashboard.service.DashboardService
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

// 어드민 대시보드 API — /api/admin/dashboard (어드민 필터체인, ROLE_ADMIN 필요)
@RestController
@RequestMapping("/api/admin/dashboard")
class AdminDashboardController(
    private val dashboardService: DashboardService,
) {
    @GetMapping
    fun summary(): DashboardSummaryResponseDto = dashboardService.summary()

    @GetMapping("/users")
    fun users(): List<DashboardUserResponseDto> = dashboardService.users()

    @GetMapping("/users/{userId}/products")
    fun userProducts(
        @PathVariable userId: Long,
    ): List<DashboardUserProductResponseDto> = dashboardService.userProducts(userId)
}
