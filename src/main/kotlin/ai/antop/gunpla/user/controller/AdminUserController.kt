package ai.antop.gunpla.user.controller

import ai.antop.gunpla.user.dto.AdminUserResponseDto
import ai.antop.gunpla.user.service.AdminUserService
import org.springframework.web.bind.annotation.*

// 사용자 관리 API — /api/admin/users (어드민 필터체인, ROLE_ADMIN 필요)
@RestController
@RequestMapping("/api/admin/users")
class AdminUserController(
    private val adminUserService: AdminUserService,
) {
    @GetMapping
    fun search(
        @RequestParam(required = false) name: String?,
        @RequestParam(required = false) email: String?,
        @RequestParam(required = false) notifyOnSale: Boolean?,
        @RequestParam(required = false) shareEnabled: Boolean?,
        @RequestParam(required = false) blocked: Boolean?,
        @RequestParam(required = false) sortBy: String?,
        @RequestParam(required = false) sortDir: String?,
    ): List<AdminUserResponseDto> = adminUserService.search(name, email, notifyOnSale, shareEnabled, blocked, sortBy, sortDir)

    @PostMapping("/{id}/block")
    fun block(
        @PathVariable id: Long,
    ): AdminUserResponseDto = adminUserService.block(id)

    @PostMapping("/{id}/unblock")
    fun unblock(
        @PathVariable id: Long,
    ): AdminUserResponseDto = adminUserService.unblock(id)
}
