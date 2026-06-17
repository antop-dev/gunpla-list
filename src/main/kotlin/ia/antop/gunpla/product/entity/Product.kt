package ia.antop.gunpla.product.entity

import jakarta.persistence.*
import java.time.LocalDateTime
import java.time.ZoneOffset

@Entity
@Table(name = "product")
class Product(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    @Column(nullable = false)
    var grade: String,
    @Column(name = "box_art_path")
    var boxArtPath: String? = null,
    @Column(name = "box_art_thumb_path")
    var boxArtThumbPath: String? = null,
    @Column(name = "model_number")
    var modelNumber: String? = null,
    @Column(nullable = false)
    var name: String,
    @Column(name = "release_year")
    var releaseYear: Int? = null,
    @Column(name = "release_month")
    var releaseMonth: Int? = null,
    @Column
    var currency: String? = null,
    @Column
    var price: Long? = null,
    @Column(name = "manual_url")
    var manualUrl: String? = null,
    @Column(name = "source_url")
    var sourceUrl: String? = null,
    @Column(name = "category_id")
    var categoryId: Long? = null,
    @Column(nullable = false)
    var deleted: Boolean = false,
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
