package ai.antop.gunpla.productrequest.dto

import ai.antop.gunpla.category.dto.CategoryResponseDto
import ai.antop.gunpla.productrequest.entity.ProductRequestStatus
import ai.antop.gunpla.productrequest.entity.ProductRequestType
import java.time.LocalDateTime

// 요청 내용과 기존 제품 값을 같은 모양으로 내려보내 화면에서 FROM -> TO 비교를 그대로 그릴 수 있게 한다
data class ProductRequestFieldsDto(
    val grade: String?,
    val modelNumber: String?,
    val name: String?,
    val releaseYear: Int?,
    val releaseMonth: Int?,
    val currency: String?,
    val price: Long?,
    val manualUrls: List<String>,
    val sourceUrl: String?,
    val series: String?,
    val category: CategoryResponseDto?,
    val boxArtUrl: String?,
    val boxArtThumbUrl: String?,
)

// 요청 조회 응답 — current 는 수정 요청일 때만 채워지는 기존 제품 값
data class ProductRequestResponseDto(
    val id: Long,
    val type: ProductRequestType,
    val status: ProductRequestStatus,
    val productId: Long?,
    val current: ProductRequestFieldsDto?,
    val requested: ProductRequestFieldsDto,
    val rejectReason: String?,
    val requesterName: String?,
    val requesterPicture: String?,
    val processedBy: String?,
    val processedAt: LocalDateTime?,
    val createdAt: LocalDateTime,
)

// 사용자 요청 생성 — type 이 MODIFY 면 productId 가 필수
data class ProductRequestCreateRequestDto(
    val type: ProductRequestType,
    val productId: Long? = null,
    val grade: String,
    val modelNumber: String? = null,
    val name: String,
    val releaseYear: Int? = null,
    val releaseMonth: Int? = null,
    val currency: String? = null,
    val price: Long? = null,
    val manualUrls: List<String> = emptyList(),
    val sourceUrl: String? = null,
    val series: String? = null,
    val categoryId: Long? = null,
)

// 승인 요청 — 관리자가 팝업에서 보정한 값이 그대로 제품에 반영된다
// applyBoxArt 는 사용자가 첨부한 박스아트를 제품에 적용할지 여부
data class ProductRequestApproveRequestDto(
    val grade: String,
    val modelNumber: String? = null,
    val name: String,
    val releaseYear: Int? = null,
    val releaseMonth: Int? = null,
    val currency: String? = null,
    val price: Long? = null,
    val manualUrls: List<String> = emptyList(),
    val sourceUrl: String? = null,
    val series: String? = null,
    val categoryId: Long? = null,
    val applyBoxArt: Boolean = true,
)

data class ProductRequestRejectRequestDto(
    val reason: String,
)

// 어드민 헤더 뱃지용 미처리 건수
data class ProductRequestPendingCountDto(
    val count: Long,
)
