package ia.antop.gunpla.user.entity

import jakarta.persistence.*
import java.time.LocalDateTime
import java.time.ZoneOffset

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
    @Column(nullable = false)
    var owned: Boolean = false,
    @Column(name = "purchase_date")
    var purchaseDate: String? = null,
    @Column(name = "purchase_place")
    var purchasePlace: String? = null,
    @Column(name = "purchase_currency")
    var purchaseCurrency: String? = null,
    @Column(name = "purchase_price")
    var purchasePrice: Long? = null,
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
