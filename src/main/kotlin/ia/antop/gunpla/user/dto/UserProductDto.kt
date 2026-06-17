package ia.antop.gunpla.user.dto

import ia.antop.gunpla.product.dto.ProductResponseDto
import java.time.LocalDate

data class UserProductResponseDto(
    val product: ProductResponseDto,
    val owned: Boolean,
    val purchaseDate: LocalDate?,
    val purchasePlace: String?,
    val purchaseCurrency: String?,
    val purchasePrice: Long?,
    val decal: String?,
)

data class UserProductUpdateRequestDto(
    val owned: Boolean,
    val purchaseDate: LocalDate?,
    val purchasePlace: String?,
    val purchaseCurrency: String?,
    val purchasePrice: Long?,
    val decal: String?,
)
