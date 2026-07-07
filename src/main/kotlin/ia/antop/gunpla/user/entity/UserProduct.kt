package ia.antop.gunpla.user.entity

import jakarta.persistence.*
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneOffset

// 사용자별 제품 보유/구매 정보
// user_id + product_id 쌍이 UNIQUE 이므로 upsert 패턴으로 관리 (UserProductService 참조)
// SQLite 외래키 제약은 기본 OFF 이므로 product 삭제 시 참조 무결성은 소프트 딜리트로 보장
@Entity
@Table(name = "user_product")
class UserProduct(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    @Column(name = "user_id", nullable = false)
    var userId: Long,
    @Column(name = "product_id", nullable = false)
    var productId: Long,
    // SQLite INTEGER 0/1 로 저장되며, JPA 가 Boolean 으로 자동 변환
    @Column(nullable = false)
    var owned: Boolean = false,
    // DB 컬럼 타입 DATE (V8~V10 마이그레이션으로 TEXT → DATE 변환됨)
    @Column(name = "purchase_date")
    var purchaseDate: LocalDate? = null,
    @Column(name = "purchase_place")
    var purchasePlace: String? = null,
    @Column(name = "purchase_currency")
    var purchaseCurrency: String? = null,
    @Column(name = "purchase_price")
    var purchasePrice: Long? = null,
    @Column
    var assembled: Boolean = false,
    @Column(name = "decal_attached")
    var decalAttached: Boolean = false,
    @Column
    var decal: String? = null,
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
