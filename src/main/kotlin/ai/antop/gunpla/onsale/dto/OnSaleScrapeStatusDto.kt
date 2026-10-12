package ai.antop.gunpla.onsale.dto

import ai.antop.gunpla.onsale.entity.OnSaleScrapeStatus
import java.time.LocalDateTime

// 관리자 대시보드 — 출처별 스크래핑 상태 요약
// problemCount 는 최근 결과가 SUCCESS 가 아니거나(EMPTY/FAILED) 배치가 한동안 돌지 않은(stale) 출처 수
data class OnSaleScrapeStatusResponseDto(
    val running: Boolean,
    val problemCount: Int,
    val sources: List<OnSaleSourceStatusDto>,
)

data class OnSaleSourceStatusDto(
    val source: String,
    // 아직 한 번도 실행되지 않았으면(또는 이력이 보관 기간을 지나 지워졌으면) latest = null
    val latest: OnSaleScrapeLogDto?,
    val lastSuccessAt: LocalDateTime?,
    // 최근부터 거슬러 올라가며 연속으로 SUCCESS 가 아니었던 횟수
    val consecutiveProblems: Int,
    // 최근 실행이 배치 주기보다 한참 오래됨 — 서버가 멈췄거나 배치가 돌지 않는 상태
    val stale: Boolean,
    // on_sale_product 에 적재돼 있는 건수 (실패/0건이어도 이전 수집분은 그대로 남아 있음)
    val storedCount: Long,
) {
    val problem: Boolean
        get() = stale || (latest != null && latest.status != OnSaleScrapeStatus.SUCCESS)
}

data class OnSaleScrapeLogDto(
    val id: Long,
    val source: String,
    val status: OnSaleScrapeStatus,
    val itemCount: Int,
    val errorMessage: String?,
    val durationMs: Long,
    val startedAt: LocalDateTime,
)
