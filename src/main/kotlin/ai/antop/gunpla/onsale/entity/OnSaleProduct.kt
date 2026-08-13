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
    /** 해시값 (PK, source|grade|name 을 SHA-256 한 값) */
    @Id
    @Column(nullable = false)
    var hash: String,
    /** 출처 (수집한 쇼핑몰 이름) */
    @Column(nullable = false)
    var source: String,
    /** 등급 */
    @Column(nullable = false)
    var grade: String,
    /** 제품명 */
    @Column(nullable = false)
    var name: String,
    /** 상태 (판매중/품절) */
    @Column(nullable = false)
    var status: String,
    /** 판매가격 */
    @Column
    var price: BigDecimal? = null,
    /** 통화 (KRW/USD) */
    @Column(nullable = false)
    var currency: String,
    /** 상품 링크 */
    @Column(nullable = false)
    var url: String,
    /** 이미지 URL */
    @Column(name = "image_url")
    var imageUrl: String? = null,
    /** 사전예약 여부 */
    @Column(name = "is_reservation", nullable = false)
    var isReservation: Boolean = false,
    /** NEW 라벨 판정 기준 시각 */
    @Column(name = "new_since", nullable = false)
    var newSince: LocalDateTime,
    /** 생성일시 */
    @Column(name = "created_at", nullable = false)
    var createdAt: LocalDateTime = LocalDateTime.now(ZoneOffset.UTC),
    /** 수정일시 */
    @Column(name = "updated_at", nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now(ZoneOffset.UTC),
) {
    @PreUpdate
    fun onUpdate() {
        updatedAt = LocalDateTime.now(ZoneOffset.UTC)
    }
}
