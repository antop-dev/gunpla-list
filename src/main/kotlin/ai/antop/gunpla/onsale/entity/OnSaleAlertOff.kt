package ai.antop.gunpla.onsale.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime
import java.time.ZoneOffset

// 사용자가 알림을 끈 판매제품 — 제품별 알림은 기본 켬이라 행이 있으면 끔, 없으면 켬 (user_id + product_hash UNIQUE)
@Entity
@Table(name = "on_sale_alert_off")
class OnSaleAlertOff(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    @Column(name = "user_id", nullable = false)
    var userId: Long,
    /** on_sale_product.hash */
    @Column(name = "product_hash", nullable = false)
    var productHash: String,
    @Column(name = "created_at", nullable = false)
    var createdAt: LocalDateTime = LocalDateTime.now(ZoneOffset.UTC),
)
