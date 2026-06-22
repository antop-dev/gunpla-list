package ia.antop.gunpla.user.controller

import ia.antop.gunpla.common.config.AppProperties
import ia.antop.gunpla.common.exception.UnauthorizedException
import ia.antop.gunpla.user.dto.UserProductResponseDto
import ia.antop.gunpla.user.dto.UserProductUpdateRequestDto
import ia.antop.gunpla.user.service.UserProductService
import org.springframework.security.core.Authentication
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken
import org.springframework.web.bind.annotation.*

// 로그인한 사용자의 제품 목록 조회 및 보유정보 수정 API (/api/user/products)
@RestController
@RequestMapping("/api/user/products")
class UserProductController(
    private val userProductService: UserProductService,
    private val appProperties: AppProperties,
) {
    /** 모든 뷰에 GA4 측정 ID 주입 (미설정 시 null → 템플릿에서 GA4 비활성) */
    @ModelAttribute("ga4")
    fun ga4(): String? = appProperties.ga4

    // OAuth2AuthenticationToken 의 "sub" 속성이 Google 계정의 고유 ID
    // 미인증이거나 OAuth2 토큰이 아니면 401 던짐
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
