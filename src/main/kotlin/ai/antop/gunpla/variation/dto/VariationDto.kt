package ai.antop.gunpla.variation.dto

import ai.antop.gunpla.product.dto.ProductResponseDto
import ai.antop.gunpla.variation.entity.VariationLinkDirection
import java.time.LocalDateTime

// 관리자 보드 목록 — 보드 이름과 올라간 제품 수
data class VariationSummaryDto(
    val id: String,
    val name: String,
    val productCount: Int,
    val updatedAt: LocalDateTime,
)

// 보드 상세 — 관리자 편집 화면과 사용자 구성도 팝업이 함께 사용한다
data class VariationResponseDto(
    val id: String,
    val name: String,
    val nodes: List<VariationNodeDto>,
    val links: List<VariationLinkDto>,
)

// 보드 위 제품 카드 — x/y 는 Drawflow 캔버스 좌표
data class VariationNodeDto(
    val product: ProductResponseDto,
    val x: Double,
    val y: Double,
)

// 원본 제품(parent) → 바리에이션 제품(child), direction 은 원본 카드에서 화살표가 나가는 변
data class VariationLinkDto(
    val parentProductId: Long,
    val childProductId: Long,
    val direction: VariationLinkDirection = VariationLinkDirection.DOWN,
)

data class VariationCreateRequestDto(
    val name: String,
)

// 보드 저장 — 카드/연결선 전체를 받아 통째로 교체한다
data class VariationSaveRequestDto(
    val name: String,
    val nodes: List<VariationNodeSaveDto> = emptyList(),
    val links: List<VariationLinkDto> = emptyList(),
)

data class VariationNodeSaveDto(
    val productId: Long,
    val x: Double,
    val y: Double,
)

// 다른 보드에 이미 올라간 제품 — 관리자 제품 검색 목록에서 표시/선택 제한에 사용
data class VariationAssignmentDto(
    val productId: Long,
    val variationId: String,
)
