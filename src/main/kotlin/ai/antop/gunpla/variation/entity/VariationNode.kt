package ai.antop.gunpla.variation.entity

import com.github.f4b6a3.ulid.UlidCreator
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table

// 보드에 올린 제품 카드와 화면 좌표 ((variation_id, product_id) UNIQUE — 제품 하나를 여러 보드에 올릴 수 있지만 한 보드에는 한 번만)
@Entity
@Table(name = "variation_node")
class VariationNode(
    // PK 는 AUTOINCREMENT 대신 ULID — 객체를 만들 때 바로 발급한다
    @Id
    var id: String = UlidCreator.getMonotonicUlid().toString(),
    @Column(name = "variation_id", nullable = false)
    var variationId: String,
    @Column(name = "product_id", nullable = false)
    var productId: Long,
    @Column(name = "pos_x", nullable = false)
    var posX: Double,
    @Column(name = "pos_y", nullable = false)
    var posY: Double,
)
