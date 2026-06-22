package ia.antop.gunpla.product.dto

import ia.antop.gunpla.category.dto.CategoryResponseDto
import java.time.LocalDateTime

// 제품 조회 응답 DTO
// boxArtUrl / boxArtThumbUrl 은 DB 의 파일시스템 경로를 서비스 계층에서 HTTP 서빙 URL 로 변환한 값
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
    val series: String?,
    val category: CategoryResponseDto?,
    val createdAt: LocalDateTime,
    val updatedAt: LocalDateTime,
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
    val manualUrl: String? = null,
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
    val manualUrl: String? = null,
    val sourceUrl: String? = null,
    val series: String? = null,
    val categoryId: Long? = null,
)

// 박스아트 외부 URL 등록 요청 DTO (URL 에서 이미지를 다운로드하여 로컬에 저장함)
data class BoxArtUrlRequestDto(
    val url: String,
)
