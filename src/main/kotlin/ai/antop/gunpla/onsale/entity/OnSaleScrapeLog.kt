package ai.antop.gunpla.onsale.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime

// 판매제품 스크래핑 이력 — OnSaleSyncService 가 배치마다 출처별로 한 행씩 남긴다
@Entity
@Table(name = "on_sale_scrape_log")
class OnSaleScrapeLog(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    /** 출처 (OnSaleScraperService.sourceName) */
    @Column(nullable = false)
    var source: String,
    /** 결과 */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var status: OnSaleScrapeStatus,
    /** 수집 건수 */
    @Column(name = "item_count", nullable = false)
    var itemCount: Int = 0,
    /** 실패 시 예외 메시지 */
    @Column(name = "error_message")
    var errorMessage: String? = null,
    /** 소요 시간(ms) */
    @Column(name = "duration_ms", nullable = false)
    var durationMs: Long = 0,
    /** 시작 일시 (UTC) */
    @Column(name = "started_at", nullable = false)
    var startedAt: LocalDateTime,
)
