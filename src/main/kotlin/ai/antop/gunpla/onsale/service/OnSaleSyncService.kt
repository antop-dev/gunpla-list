package ai.antop.gunpla.onsale.service

import ai.antop.gunpla.onsale.repository.OnSaleProductRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.event.EventListener
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import java.util.concurrent.locks.ReentrantLock

private val log = KotlinLogging.logger {}

// OnSaleScraperService 구현체를 스크래핑해 결과를 on_sale_product 테이블에 upsert(OnSaleUpsertService) 하는 배치 — 매 요청마다
// 대상 사이트를 스크래핑하던 기존 방식 대신, 서버 기동 직후 1회 + 이후 5분 간격(매시 0/5/10/.../55분)으로만 스크래핑해 사이트 부하를 줄임
// 스케줄과 기동 직후 실행이 겹칠 수 있어(예: 00:59:58 기동 스크래핑 중 01:00:00 배치 트리거) ReentrantLock.tryLock()으로
// 동시 실행을 막음 — 이미 실행 중이면 새 트리거는 대기하지 않고 그냥 건너뜀(스케줄 자체가 촘촘해 다음 트리거에서 다시 시도됨)
@Service
class OnSaleSyncService(
    private val scraperServices: List<OnSaleScraperService>,
    private val onSaleProductRepository: OnSaleProductRepository,
    private val onSaleUpsertService: OnSaleUpsertService,
    private val onSaleNotificationService: OnSaleNotificationService,
) {
    private val syncLock = ReentrantLock()

    @EventListener(ApplicationReadyEvent::class)
    fun onStartup() = sync()

    @Scheduled(cron = "0 */5 * * * *")
    fun onSchedule() = sync()

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
            val scraped =
                scraperServices.flatMap { scraper ->
                    runCatching { scraper.scrapeAll() }
                        .onFailure { log.error(it) { "on-sale scrape failed: ${scraper::class.simpleName}" } }
                        .getOrDefault(emptyList())
                }
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
}
