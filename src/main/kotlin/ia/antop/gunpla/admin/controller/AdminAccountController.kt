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

// 어드민 계정 관리 API — 현재는 비밀번호 변경만 제공
@RestController
@RequestMapping("/api/admin")
class AdminAccountController(
    private val adminAccountService: AdminAccountService,
) {
    // Principal.name 은 Form 로그인 시 username 과 동일
    @PutMapping("/password")
    fun changePassword(
        @RequestBody request: ChangePasswordRequest,
        principal: Principal,
    ): ResponseEntity<Unit> {
        adminAccountService.changePassword(principal.name, request.currentPassword, request.newPassword)
        return ResponseEntity.noContent().build()
    }
}
