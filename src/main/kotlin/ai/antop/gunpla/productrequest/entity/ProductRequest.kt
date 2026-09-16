package ai.antop.gunpla.productrequest.entity

import ai.antop.gunpla.common.converter.NewlineSeparatedListConverter
import jakarta.persistence.*
import java.time.LocalDateTime
import java.time.ZoneOffset

// 사용자가 올린 제품 등록/수정 요청 엔티티
// 요청 당시 입력값을 그대로 보관하며, 승인 시점에 관리자가 확인/보정한 값으로 product 에 반영된다
// box_art_path / box_art_thumb_path 는 product 와 동일하게 파일시스템 절대경로를 저장한다
@Entity
@Table(name = "product_request")
class ProductRequest(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var type: ProductRequestType,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    var status: ProductRequestStatus = ProductRequestStatus.PENDING,
    // 요청한 사용자 (user_account.id)
    @Column(name = "user_id", nullable = false)
    var userId: Long,
    // 수정 요청일 때 대상 제품, 등록 요청이면 null
    @Column(name = "product_id")
    var productId: Long? = null,
    @Column(nullable = false)
    var grade: String,
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
    // product 와 동일하게 컬럼 하나에 개행으로 합쳐 저장하고 코드에서는 목록으로 다룬다
    @Convert(converter = NewlineSeparatedListConverter::class)
    @Column(name = "manual_url")
    var manualUrls: List<String> = emptyList(),
    @Column(name = "source_url")
    var sourceUrl: String? = null,
    @Column
    var series: String? = null,
    @Column(name = "category_id")
    var categoryId: Long? = null,
    @Column(name = "box_art_path")
    var boxArtPath: String? = null,
    @Column(name = "box_art_thumb_path")
    var boxArtThumbPath: String? = null,
    // 반려 시 관리자가 입력한 사유
    @Column(name = "reject_reason")
    var rejectReason: String? = null,
    @Column(name = "processed_at")
    var processedAt: LocalDateTime? = null,
    // 처리한 관리자 계정명
    @Column(name = "processed_by")
    var processedBy: String? = null,
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
