package ai.antop.gunpla.product.entity

import jakarta.persistence.*
import java.time.LocalDateTime
import java.time.ZoneOffset

// 제품 박스아트 — 제품 하나에 여러 장을 등록할 수 있다 (sort_order 오름차순, 첫 번째가 대표 이미지)
// box_art_path / box_art_thumb_path 는 박스아트 디렉토리 안의 파일명만 저장하며, 서빙 URL 변환은 ProductService 에서 수행
@Entity
@Table(name = "product_box_art")
class ProductBoxArt(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    @Column(name = "product_id", nullable = false)
    var productId: Long,
    // 원본 이미지 파일명 (업로드 파일 or URL에서 다운로드한 파일)
    @Column(name = "box_art_path", nullable = false)
    var boxArtPath: String,
    // 썸네일 이미지 파일명 (원본에서 자동 생성, 100x50 px JPEG)
    @Column(name = "box_art_thumb_path")
    var boxArtThumbPath: String? = null,
    @Column(name = "sort_order", nullable = false)
    var sortOrder: Int,
    @Column(name = "created_at", nullable = false)
    var createdAt: LocalDateTime = LocalDateTime.now(ZoneOffset.UTC),
)
