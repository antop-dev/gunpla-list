package ia.antop.gunpla.user.dto

import ia.antop.gunpla.product.dto.ProductResponseDto
import java.time.LocalDate

// 사용자 뷰 응답 DTO — product 필드에 ProductResponseDto 를 그대로 포함하여 중복 정의를 피함
// 비로그인 시에는 ProductResponseDto 만 반환하고, 로그인 시에는 이 DTO 를 반환 (user.js 의 getProd() 참조)
data class UserProductResponseDto(
    val product: ProductResponseDto,
    val owned: Boolean,
    val purchaseDate: LocalDate?,
    val purchasePlace: String?,
    val purchaseCurrency: String?,
    val purchasePrice: Long?,
    val decal: String?,
)

// 사용자 제품 정보 업데이트 요청 DTO
// 항상 모든 필드를 전송하고 서버에서 통째로 덮어씀 (부분 업데이트 없음)
data class UserProductUpdateRequestDto(
    val owned: Boolean,
    val purchaseDate: LocalDate?,
    val purchasePlace: String?,
    val purchaseCurrency: String?,
    val purchasePrice: Long?,
    val decal: String?,
)
