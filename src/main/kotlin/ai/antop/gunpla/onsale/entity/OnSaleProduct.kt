package ai.antop.gunpla.onsale.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.PreUpdate
import jakarta.persistence.Table
import java.math.BigDecimal
import java.time.LocalDateTime
import java.time.ZoneOffset

// 판매제품 모아보기 — 외부 쇼핑몰 스크래핑 결과를 배치로 적재하는 테이블
// hash = SHA-256(source|grade|name) 를 PK 로 사용해 동일 제품을 매 배치마다 같은 행으로 upsert
// newSince 는 "NEW" 라벨 판정 기준 시각 — 최초 등록 시, 그리고 품절→판매중으로 바뀔 때마다 현재 시각으로 갱신됨
// (OnSaleSyncService 참고). 스크래핑 목록에서 더 이상 보이지 않는 제품(단종/판매 종료 등)은 삭제하지 않고
// 마지막 스크래핑 상태를 그대로 유지 — 요구사항 범위 밖(목록에서 사라지는 케이스에 대한 처리는 별도 논의 필요)
@Entity
@Table(name = "on_sale_product")
class OnSaleProduct(
    @Id
    @Column(nullable = false)
    var hash: String,
    @Column(nullable = false)
    var source: String,
    @Column(nullable = false)
    var grade: String,
    @Column(nullable = false)
    var name: String,
    @Column(nullable = false)
    var status: String,
    @Column
    var price: BigDecimal? = null,
    @Column(nullable = false)
    var currency: String,
    @Column(nullable = false)
    var url: String,
    @Column(name = "image_url")
    var imageUrl: String? = null,
    @Column(name = "new_since", nullable = false)
    var newSince: LocalDateTime,
    @Column(name = "created_at", nullable = false)
    var createdAt: LocalDateTime = LocalDateTime.now(ZoneOffset.UTC),
    @Column(name = "updated_at", nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now(ZoneOffset.UTC),
) {
    @PreUpdate
    fun onUpdate() {
        updatedAt = LocalDateTime.now(ZoneOffset.UTC)
    }
}
