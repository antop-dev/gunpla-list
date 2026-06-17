package ia.antop.gunpla.product.dto

import ia.antop.gunpla.category.dto.CategoryResponseDto
import java.time.LocalDateTime

data class ProductResponseDto(
    val id: Long,
    val grade: String,
    val boxArtUrl: String?,
    val boxArtThumbUrl: String?,
    val modelNumber: String?,
    val name: String,
    val releaseYear: Int?,
    val releaseMonth: Int?,
    val currency: String?,
    val price: Long?,
    val manualUrl: String?,
    val sourceUrl: String?,
    val category: CategoryResponseDto?,
    val createdAt: LocalDateTime,
    val updatedAt: LocalDateTime,
)

data class ProductCreateRequestDto(
    val grade: String,
    val modelNumber: String?,
    val name: String,
    val releaseYear: Int?,
    val releaseMonth: Int?,
    val currency: String?,
    val price: Long?,
    val manualUrl: String? = null,
    val sourceUrl: String? = null,
    val categoryId: Long? = null,
)

data class ProductUpdateRequestDto(
    val grade: String,
    val modelNumber: String?,
    val name: String,
    val releaseYear: Int?,
    val releaseMonth: Int?,
    val currency: String?,
    val price: Long?,
    val manualUrl: String? = null,
    val sourceUrl: String? = null,
    val categoryId: Long? = null,
)

data class BoxArtUrlRequestDto(
    val url: String,
)
