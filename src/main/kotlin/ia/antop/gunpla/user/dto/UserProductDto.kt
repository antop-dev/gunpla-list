package ia.antop.gunpla.user.dto

import ia.antop.gunpla.product.dto.ProductResponseDto

data class UserProductResponseDto(
    val product: ProductResponseDto,
    val owned: Boolean,
    val purchaseDate: String?,
    val purchasePlace: String?,
    val purchaseCurrency: String?,
    val purchasePrice: Long?,
    val decal: String?,
)

data class UserProductUpdateRequestDto(
    val owned: Boolean,
    val purchaseDate: String?,
    val purchasePlace: String?,
    val purchaseCurrency: String?,
    val purchasePrice: Long?,
    val decal: String?,
)
