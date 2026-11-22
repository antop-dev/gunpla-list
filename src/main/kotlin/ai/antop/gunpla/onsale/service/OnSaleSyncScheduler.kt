package ai.antop.gunpla.onsale.service

import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.annotation.Profile
import org.springframework.context.event.EventListener
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

// 판매제품 수집 트리거 — 서버 기동 직후 1회 + 30초 간격으로 OnSaleSyncService.sync() 를 호출한다
// 외부 사이트 스크래핑과 신규 판매 알림 메일 발송이 함께 일어나므로 prd 프로파일에서만 동작한다
@Component
@Profile("prd")
class OnSaleSyncScheduler(
    private val onSaleSyncService: OnSaleSyncService,
) {
    @EventListener(ApplicationReadyEvent::class)
    fun onStartup() {
        onSaleSyncService.sync()
    }

    @Scheduled(cron = "*/30 * * * * *")
    fun onSchedule() {
        onSaleSyncService.sync()
    }
}
