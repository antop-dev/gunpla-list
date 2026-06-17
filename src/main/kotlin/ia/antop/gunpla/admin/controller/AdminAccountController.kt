package ia.antop.gunpla.admin.controller

import ia.antop.gunpla.admin.service.AdminAccountService
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.security.Principal

data class ChangePasswordRequest(
    val currentPassword: String,
    val newPassword: String,
)

@RestController
@RequestMapping("/api/admin")
class AdminAccountController(
    private val adminAccountService: AdminAccountService,
) {
    @PutMapping("/password")
    fun changePassword(
        @RequestBody request: ChangePasswordRequest,
        principal: Principal,
    ): ResponseEntity<Unit> {
        adminAccountService.changePassword(principal.name, request.currentPassword, request.newPassword)
        return ResponseEntity.noContent().build()
    }
}
