package ia.antop.gunpla.admin.controller

import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping

@Controller
@RequestMapping("/admin")
class AdminPageController {
    @GetMapping("", "/")
    fun index() = "redirect:/admin/products"

    @GetMapping("/login")
    fun login() = "login"

    @GetMapping("/products")
    fun products() = "admin"
}
