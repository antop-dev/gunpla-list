package ai.antop.gunpla.onsale.repository

import ai.antop.gunpla.onsale.entity.OnSaleAlertOff
import org.springframework.data.jpa.repository.JpaRepository

interface OnSaleAlertOffRepository : JpaRepository<OnSaleAlertOff, Long> {
    fun findAllByUserId(userId: Long): List<OnSaleAlertOff>

    // 알림 발송 제외 대상 조회 — OnSaleNotificationService 에서 이번 배치에 새로 판매중이 된 제품 해시로 조회
    fun findAllByProductHashIn(productHashes: Collection<String>): List<OnSaleAlertOff>
}
