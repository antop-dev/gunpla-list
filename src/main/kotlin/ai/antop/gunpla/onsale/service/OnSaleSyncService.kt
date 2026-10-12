package ai.antop.gunpla.onsale.service

import ai.antop.gunpla.onsale.dto.OnSaleProductDto
import ai.antop.gunpla.onsale.entity.OnSaleScrapeLog
import ai.antop.gunpla.onsale.entity.OnSaleScrapeStatus
import ai.antop.gunpla.onsale.repository.OnSaleProductRepository
import ai.antop.gunpla.onsale.repository.OnSaleScrapeLogRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.event.EventListener
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import java.time.Duration
import java.time.LocalDateTime
import java.time.ZoneOffset
import java.util.concurrent.locks.ReentrantLock

private val log = KotlinLogging.logger {}

// OnSaleScraperService 구현체를 스크래핑해 결과를 on_sale_product 테이블에 upsert(OnSaleUpsertService) 하는 배치 — 매 요청마다
// 대상 사이트를 스크래핑하던 기존 방식 대신, 서버 기동 직후 1회 + 이후 2분 간격(매시 0/2/4/.../58분)으로만 스크래핑해 사이트 부하를 줄임
// 스케줄과 기동 직후 실행이 겹칠 수 있어(예: 00:59:58 기동 스크래핑 중 01:00:00 배치 트리거) ReentrantLock.tryLock()으로
// 동시 실행을 막음 — 이미 실행 중이면 새 트리거는 대기하지 않고 그냥 건너뜀(스케줄 자체가 촘촘해 다음 트리거에서 다시 시도됨)
// 출처별 결과(성공/0건/실패, 건수, 소요 시간)는 on_sale_scrape_log 에 남겨 관리자 대시보드에서 확인한다
@Service
class OnSaleSyncService(
    private val scraperServices: List<OnSaleScraperService>,
    private val onSaleProductRepository: OnSaleProductRepository,
    private val onSaleUpsertService: OnSaleUpsertService,
    private val onSaleNotificationService: OnSaleNotificationService,
    private val onSaleScrapeLogRepository: OnSaleScrapeLogRepository,
) {
    private val syncLock = ReentrantLock()

    @EventListener(ApplicationReadyEvent::class)
    fun onStartup() {
        sync()
    }

    @Scheduled(cron = "0 */2 * * * *")
    fun onSchedule() {
        sync()
    }

    val isRunning: Boolean
        get() = syncLock.isLocked

    fun sync() {
        if (!syncLock.tryLock()) {
            log.info { "on-sale sync already in progress, skip this trigger" }
            return
        }
        try {
            // 테이블이 비어 있던 상태(최초 배포/DB 초기화 직후)라면 지금 스크래핑되는 제품 전부가
            // "신규"로 잡혀버린다 — 비교할 이전 상태가 아예 없기 때문. 이 최초 적재 배치는 알림 대상에서 제외하고
            // 이후 배치부터 실제로 새로 판매중이 된 제품만 알림 대상으로 삼는다
            val isColdStart = onSaleProductRepository.count() == 0L

            // 사이트 하나가 막히거나 실패해도 나머지 사이트 결과는 이번 배치에 반영되도록 소스별로 개별 catch
            val scraped = scraperServices.flatMap { scrapeAndLog(it) }
            val newlyOnSale = onSaleUpsertService.upsertAll(scraped)
            if (isColdStart) {
                log.info { "on-sale sync: cold start (empty table) - skip notification for this batch" }
            } else if (newlyOnSale.isNotEmpty()) {
                onSaleNotificationService.notifyNewOnSaleProducts(newlyOnSale)
            }
            log.info { "on-sale sync done: ${scraped.size} items scraped, ${newlyOnSale.size} newly on sale" }
        } catch (e: Exception) {
            log.error(e) { "on-sale sync failed" }
        } finally {
            syncLock.unlock()
        }
    }

    private fun scrapeAndLog(scraper: OnSaleScraperService): List<OnSaleProductDto> {
        val startedAt = LocalDateTime.now(ZoneOffset.UTC)
        val startNanos = System.nanoTime()
        val result =
            runCatching { scraper.scrapeAll() }
                .onFailure { log.error(it) { "on-sale scrape failed: ${scraper.sourceName}" } }
        val items = result.getOrDefault(emptyList())
        val status =
            when {
                result.isFailure -> OnSaleScrapeStatus.FAILED
                items.isEmpty() -> OnSaleScrapeStatus.EMPTY
                else -> OnSaleScrapeStatus.SUCCESS
            }
        if (status == OnSaleScrapeStatus.EMPTY) log.warn { "on-sale scrape returned 0 items: ${scraper.sourceName}" }

        // 이력 저장 실패가 수집 결과 반영까지 막지 않도록 따로 감싼다
        runCatching {
            onSaleScrapeLogRepository.save(
                OnSaleScrapeLog(
                    source = scraper.sourceName,
                    status = status,
                    itemCount = items.size,
                    errorMessage = result.exceptionOrNull()?.let { errorMessage(it) },
                    durationMs = Duration.ofNanos(System.nanoTime() - startNanos).toMillis(),
                    startedAt = startedAt,
                ),
            )
            onSaleScrapeLogRepository.deleteOlderThan(startedAt.minus(LOG_RETENTION))
        }.onFailure { log.error(it) { "on-sale scrape log save failed: ${scraper.sourceName}" } }
        return items
    }

    // 래핑된 예외(ExecutionException 등)는 메시지가 원인 예외의 toString 이라 원인 쪽을 그대로 보여준다
    private fun errorMessage(e: Throwable): String {
        val root = generateSequence(e) { it.cause }.last()
        return "${root::class.simpleName}: ${root.message.orEmpty()}".take(ERROR_MESSAGE_MAX_LENGTH)
    }

    companion object {
        // 2분 간격 × 출처 수만큼 쌓이므로 최근 7일만 보관
        val LOG_RETENTION: Duration = Duration.ofDays(7)
        private const val ERROR_MESSAGE_MAX_LENGTH = 1000
    }
}
