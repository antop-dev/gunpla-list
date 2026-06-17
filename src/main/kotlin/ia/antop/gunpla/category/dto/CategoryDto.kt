package ia.antop.gunpla.category.dto

// 카테고리 조회 응답 DTO — ProductResponseDto.category 필드에도 포함됨
data class CategoryResponseDto(
    val id: Long,
    val name: String,
    val color: String,
    val sortOrder: Int,
)

// 생성 시 sortOrder 는 서버에서 0 으로 초기화하므로 요청에 포함하지 않음
data class CategoryCreateRequestDto(
    val name: String,
    val color: String = "#6c757d",
)

data class CategoryUpdateRequestDto(
    val name: String,
    val color: String,
    val sortOrder: Int,
)
