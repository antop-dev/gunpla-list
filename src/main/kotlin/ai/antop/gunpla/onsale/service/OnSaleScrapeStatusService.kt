package ai.antop.gunpla.onsale.service

import ai.antop.gunpla.onsale.dto.OnSaleScrapeLogDto
import ai.antop.gunpla.onsale.dto.OnSaleScrapeStatusResponseDto
import ai.antop.gunpla.onsale.dto.OnSaleSourceStatusDto
import ai.antop.gunpla.onsale.entity.OnSaleScrapeLog
import ai.antop.gunpla.onsale.entity.OnSaleScrapeStatus
import ai.antop.gunpla.onsale.repository.OnSaleProductRepository
import ai.antop.gunpla.onsale.repository.OnSaleScrapeLogRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Duration
import java.time.LocalDateTime
import java.time.ZoneOffset

// 관리자 대시보드 출처별 수집 상태 — 스크래핑 이력(on_sale_scrape_log)으로 출처별 수집 상태를 집계
// 이력은 최근 7일분(수천 건)만 남아 있어 전체 조회 후 인메모리로 집계한다
@Service
class OnSaleScrapeStatusService(
    private val scraperServices: List<OnSaleScraperService>,
    private val onSaleSyncService: OnSaleSyncService,
    private val onSaleScrapeLogRepository: OnSaleScrapeLogRepository,
    private val onSaleProductRepository: OnSaleProductRepository,
) {
    @Transactional(readOnly = true)
    fun status(): OnSaleScrapeStatusResponseDto {
        val now = LocalDateTime.now(ZoneOffset.UTC)
        val logsBySource = onSaleScrapeLogRepository.findAllByOrderByStartedAtDescIdDesc().groupBy { it.source }
        val storedCounts =
            onSaleProductRepository.countGroupBySource().associate { (source, count) -> source as String to (count as Number).toLong() }

        // 스크래퍼 빈 순서(@Order)대로 보여주고, 스크래퍼가 제거돼 이력만 남은 출처는 뒤에 붙인다
        val sources = (scraperServices.map { it.sourceName } + logsBySource.keys).distinct()
        val statuses =
            sources.map { source ->
                val logs = logsBySource[source].orEmpty()
                val latest = logs.firstOrNull()
                OnSaleSourceStatusDto(
                    source = source,
                    latest = latest?.toDto(),
                    lastSuccessAt = logs.firstOrNull { it.status == OnSaleScrapeStatus.SUCCESS }?.startedAt,
                    consecutiveProblems = logs.takeWhile { it.status != OnSaleScrapeStatus.SUCCESS }.size,
                    stale = latest != null && Duration.between(latest.startedAt, now) > STALE_THRESHOLD,
                    storedCount = storedCounts[source] ?: 0,
                )
            }
        return OnSaleScrapeStatusResponseDto(
            running = onSaleSyncService.isRunning,
            problemCount = statuses.count { it.problem },
            sources = statuses,
        )
    }

    @Transactional(readOnly = true)
    fun logs(source: String): List<OnSaleScrapeLogDto> =
        onSaleScrapeLogRepository.findAllBySourceOrderByStartedAtDescIdDesc(source).map { it.toDto() }

    private fun OnSaleScrapeLog.toDto() =
        OnSaleScrapeLogDto(
            id = id!!,
            source = source,
            status = status,
            itemCount = itemCount,
            errorMessage = errorMessage,
            durationMs = durationMs,
            startedAt = startedAt,
        )

    companion object {
        // 배치는 2분 간격 — 여유를 두고 10분 넘게 새 이력이 없으면 배치가 멈춘 것으로 본다
        private val STALE_THRESHOLD = Duration.ofMinutes(10)
    }
}
