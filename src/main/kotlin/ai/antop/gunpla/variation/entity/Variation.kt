package ai.antop.gunpla.variation.entity

import com.github.f4b6a3.ulid.UlidCreator
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.PreUpdate
import jakarta.persistence.Table
import java.time.LocalDateTime
import java.time.ZoneOffset

// 바리에이션 구성도 보드 — 제품 카드(VariationNode)와 연결선(VariationLink)을 묶는 단위
@Entity
@Table(name = "variation")
class Variation(
    // PK 는 AUTOINCREMENT 대신 ULID — 객체를 만들 때 바로 발급한다
    @Id
    var id: String = UlidCreator.getMonotonicUlid().toString(),
    @Column(nullable = false)
    var name: String,
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
