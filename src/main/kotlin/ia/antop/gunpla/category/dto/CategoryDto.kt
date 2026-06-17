package ia.antop.gunpla.category.dto

data class CategoryResponseDto(
    val id: Long,
    val name: String,
    val color: String,
    val sortOrder: Int,
)

data class CategoryCreateRequestDto(
    val name: String,
    val color: String = "#6c757d",
)

data class CategoryUpdateRequestDto(
    val name: String,
    val color: String,
    val sortOrder: Int,
)
