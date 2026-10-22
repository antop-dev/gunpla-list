package ai.antop.gunpla.variation.entity

import com.github.f4b6a3.ulid.UlidCreator
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.Table

// 원본 제품(parent) → 바리에이션 제품(child) 화살표
@Entity
@Table(name = "variation_link")
class VariationLink(
    // PK 는 AUTOINCREMENT 대신 ULID — 객체를 만들 때 바로 발급한다
    @Id
    var id: String = UlidCreator.getMonotonicUlid().toString(),
    @Column(name = "variation_id", nullable = false)
    var variationId: String,
    @Column(name = "parent_product_id", nullable = false)
    var parentProductId: Long,
    @Column(name = "child_product_id", nullable = false)
    var childProductId: Long,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var direction: VariationLinkDirection = VariationLinkDirection.DOWN,
)
