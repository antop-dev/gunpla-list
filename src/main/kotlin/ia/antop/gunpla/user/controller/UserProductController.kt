package ia.antop.gunpla.user.controller

import ia.antop.gunpla.common.exception.UnauthorizedException
import ia.antop.gunpla.user.dto.UserProductResponseDto
import ia.antop.gunpla.user.dto.UserProductUpdateRequestDto
import ia.antop.gunpla.user.service.UserProductService
import org.springframework.security.core.Authentication
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/user/products")
class UserProductController(
    private val userProductService: UserProductService,
) {
    private fun Authentication?.googleId(): String =
        (this as? OAuth2AuthenticationToken)?.principal?.getAttribute<String>("sub")
            ?: throw UnauthorizedException()

    @GetMapping
    fun search(
        authentication: Authentication?,
        @RequestParam(required = false) name: String?,
        @RequestParam(required = false) grade: String?,
        @RequestParam(required = false) modelNumber: String?,
        @RequestParam(required = false) categoryId: Long?,
        @RequestParam(required = false) owned: Boolean?,
        @RequestParam(required = false) purchasePlace: String?,
        @RequestParam(required = false) decal: String?,
        @RequestParam(required = false) keyword: String?,
    ): List<UserProductResponseDto> =
        userProductService.search(authentication.googleId(), name, grade, modelNumber, categoryId, owned, purchasePlace, decal, keyword)

    @PutMapping("/{productId}")
    fun update(
        authentication: Authentication?,
        @PathVariable productId: Long,
        @RequestBody request: UserProductUpdateRequestDto,
    ): UserProductResponseDto = userProductService.update(authentication.googleId(), productId, request)
}
