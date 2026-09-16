package ai.antop.gunpla.productrequest.controller

import ai.antop.gunpla.common.exception.UnauthorizedException
import ai.antop.gunpla.productrequest.dto.ProductRequestCreateRequestDto
import ai.antop.gunpla.productrequest.dto.ProductRequestResponseDto
import ai.antop.gunpla.productrequest.service.ProductRequestService
import org.springframework.http.HttpStatus
import org.springframework.security.core.Authentication
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken
import org.springframework.web.bind.annotation.*
import org.springframework.web.multipart.MultipartFile

// 로그인 사용자의 제품 등록/수정 요청 API (/api/user/product-requests)
// 여기서 만든 요청은 PENDING 상태로만 저장되며, 실제 제품 반영은 어드민 승인 시 이루어진다
@RestController
@RequestMapping("/api/user/product-requests")
class UserProductRequestController(
    private val productRequestService: ProductRequestService,
) {
    // OAuth2AuthenticationToken 의 "sub" 속성이 Google 계정의 고유 ID (UserProductController 와 동일 규칙)
    private fun Authentication?.googleId(): String =
        (this as? OAuth2AuthenticationToken)?.principal?.getAttribute<String>("sub")
            ?: throw UnauthorizedException()

    @GetMapping
    fun findMine(authentication: Authentication?): List<ProductRequestResponseDto> =
        productRequestService.findMine(authentication.googleId())

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(
        authentication: Authentication?,
        @RequestBody request: ProductRequestCreateRequestDto,
    ): ProductRequestResponseDto = productRequestService.create(authentication.googleId(), request)

    @PostMapping("/{id}/box-art")
    fun uploadBoxArt(
        authentication: Authentication?,
        @PathVariable id: Long,
        @RequestParam("file") file: MultipartFile,
    ): ProductRequestResponseDto = productRequestService.uploadBoxArt(authentication.googleId(), id, file)

    // 취소는 삭제가 아니라 상태 전이라 POST — 취소된 요청도 이력으로 계속 조회된다
    @PostMapping("/{id}/cancel")
    fun cancel(
        authentication: Authentication?,
        @PathVariable id: Long,
    ): ProductRequestResponseDto = productRequestService.cancel(authentication.googleId(), id)
}
