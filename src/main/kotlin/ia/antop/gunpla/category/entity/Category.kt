package ia.antop.gunpla.category.entity

import jakarta.persistence.*
import java.time.LocalDateTime
import java.time.ZoneOffset

// 건프라 제품 구분(카테고리) 엔티티
// sortOrder 로 표시 순서를 제어하며 name 은 UNIQUE 제약
@Entity
@Table(name = "category")
class Category(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    @Column(unique = true, nullable = false)
    var name: String,
    // 어드민 UI 에서 구분 뱃지 색상으로 사용하는 CSS hex 값
    @Column(nullable = false)
    var color: String = "#6c757d",
    @Column(name = "sort_order", nullable = false)
    var sortOrder: Int = 0,
    @Column(name = "created_at", nullable = false)
    var createdAt: LocalDateTime = LocalDateTime.now(ZoneOffset.UTC),
)
