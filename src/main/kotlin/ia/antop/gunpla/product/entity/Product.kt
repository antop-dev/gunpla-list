package ia.antop.gunpla.product.entity

import jakarta.persistence.*
import java.time.LocalDateTime
import java.time.ZoneOffset

// 건프라 제품 마스터 엔티티
// box_art_path / box_art_thumb_path 는 파일시스템 절대경로를 저장하며, 서빙 URL 변환은 ProductService 에서 수행
@Entity
@Table(name = "product")
class Product(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    @Column(nullable = false)
    var grade: String,
    // 원본 이미지 파일 경로 (업로드 파일 or URL에서 다운로드한 파일)
    @Column(name = "box_art_path")
    var boxArtPath: String? = null,
    // 썸네일 이미지 파일 경로 (원본에서 자동 생성, 100x50 px JPEG)
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
    // 제품 정보 원출처 링크 (공식 사이트, 뉴스 등)
    @Column(name = "source_url")
    var sourceUrl: String? = null,
    // 카테고리 N:1 직접 참조 (V2 에서 product_category 중간 테이블에서 전환됨)
    @Column(name = "category_id")
    var categoryId: Long? = null,
    // 논리 삭제 플래그 — 물리 삭제 시 user_product 참조가 고아가 되므로 소프트 딜리트 사용
    @Column(nullable = false)
    var deleted: Boolean = false,
    @Column(name = "created_at", nullable = false)
    var createdAt: LocalDateTime = LocalDateTime.now(ZoneOffset.UTC),
    @Column(name = "updated_at", nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now(ZoneOffset.UTC),
) {
    // JPA @PreUpdate 훅으로 updated_at 을 자동 갱신 (애플리케이션 코드에서 직접 설정 불필요)
    @PreUpdate
    fun onUpdate() {
        updatedAt = LocalDateTime.now(ZoneOffset.UTC)
    }
}
