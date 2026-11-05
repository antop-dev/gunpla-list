package ai.antop.gunpla.product.dto

import ai.antop.gunpla.category.dto.CategoryResponseDto
import java.time.LocalDateTime

// 제품 조회 응답 DTO
// boxArtUrl / boxArtThumbUrl 은 대표(첫 번째) 박스아트 — DB 의 파일명을 서비스 계층에서 HTTP 서빙 URL 로 변환한 값
// boxArts 는 등록된 박스아트 전체 (정렬 순서대로)
data class ProductResponseDto(
    val id: Long,
    val grade: String,
    val boxArtUrl: String?,
    val boxArtThumbUrl: String?,
    val boxArts: List<ProductBoxArtResponseDto> = emptyList(),
    val modelNumber: String?,
    val name: String,
    val releaseYear: Int?,
    val releaseMonth: Int?,
    val currency: String?,
    val price: Long?,
    // 매뉴얼이 여러 개인 제품이 있어 항상 목록으로 다룬다 (DB 컬럼에만 개행으로 합쳐 저장)
    val manualUrls: List<String>,
    val sourceUrl: String?,
    val series: String?,
    val category: CategoryResponseDto?,
    val createdAt: LocalDateTime,
    val updatedAt: LocalDateTime,
    // 바리에이션 구성도 보드 ID — 보드에 올라가 있지 않으면 null (사용자 그리드의 구성도 아이콘 표시 여부)
    val variationId: String? = null,
)

// Create / Update 요청 DTO 를 분리 유지 — 향후 필드 차이가 생길 경우를 대비
data class ProductCreateRequestDto(
    val grade: String,
    val modelNumber: String?,
    val name: String,
    val releaseYear: Int?,
    val releaseMonth: Int?,
    val currency: String?,
    val price: Long?,
    val manualUrls: List<String> = emptyList(),
    val sourceUrl: String? = null,
    val series: String? = null,
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
    val manualUrls: List<String> = emptyList(),
    val sourceUrl: String? = null,
    val series: String? = null,
    val categoryId: Long? = null,
)

// 박스아트 한 장 — url / thumbUrl 은 HTTP 서빙 URL
data class ProductBoxArtResponseDto(
    val id: Long,
    val url: String,
    val thumbUrl: String?,
)

// 박스아트 외부 URL 등록 요청 DTO (URL 에서 이미지를 다운로드하여 로컬에 저장함)
data class BoxArtUrlRequestDto(
    val url: String,
)

// 박스아트 순서 변경 요청 DTO — 제품의 박스아트 id 를 보여줄 순서대로 나열한다
data class BoxArtOrderRequestDto(
    val ids: List<Long>,
)
