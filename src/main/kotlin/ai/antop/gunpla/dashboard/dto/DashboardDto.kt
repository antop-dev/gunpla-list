package ai.antop.gunpla.dashboard.dto

import ai.antop.gunpla.product.dto.ProductResponseDto
import java.time.LocalDate
import java.time.LocalDateTime

// 어드민 대시보드 요약 응답 DTO — KPI 카드 + 차트 + 인기 제품 TOP 10 을 한 번에 내려준다
// "보유" 는 user_product.owned = true 이고 소프트 딜리트되지 않은 제품만 집계한 값
data class DashboardSummaryResponseDto(
    val totalUsers: Int,
    // 1개 이상 보유 중인 사용자 수
    val activeUsers: Int,
    val totalOwned: Int,
    // 보유 사용자(activeUsers) 기준 평균 — 보유 0개인 사용자는 분모에서 제외
    val avgOwnedPerActiveUser: Double,
    val notifySubscribers: Int,
    val gradeDistribution: List<DashboardGradeCountDto>,
    val categoryDistribution: List<DashboardCategoryCountDto>,
    val topProducts: List<DashboardTopProductDto>,
)

data class DashboardGradeCountDto(
    val grade: String,
    val count: Int,
)

// 구분(일반판/한정판 등)별 보유 수 — 구분이 없는 제품은 name = null
data class DashboardCategoryCountDto(
    val name: String?,
    val count: Int,
)

data class DashboardTopProductDto(
    val product: ProductResponseDto,
    val ownerCount: Int,
    val assembledCount: Int,
)

// 대시보드 사용자 목록 행 — 보유/조립 수는 서비스에서 집계
data class DashboardUserResponseDto(
    val id: Long,
    val name: String?,
    val email: String?,
    val picture: String?,
    val ownedCount: Int,
    val assembledCount: Int,
    val notifyOnSale: Boolean,
    val createdAt: LocalDateTime,
    // user_product 의 마지막 수정 시각 — 보유 데이터가 없으면 null
    val lastActivityAt: LocalDateTime?,
)

// 특정 사용자의 보유 제품 행
data class DashboardUserProductResponseDto(
    val product: ProductResponseDto,
    val assembled: Boolean,
    val decalAttached: Boolean,
    val purchaseDate: LocalDate?,
    val purchasePlace: String?,
    val purchaseCurrency: String?,
    val purchasePrice: Long?,
    val createdAt: LocalDateTime,
)
