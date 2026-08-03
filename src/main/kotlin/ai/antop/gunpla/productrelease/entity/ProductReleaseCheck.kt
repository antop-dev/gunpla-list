package ai.antop.gunpla.productrelease.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.LocalDateTime
import java.time.ZoneOffset

// 관리자가 "확인완료"로 표시한 제품 출시 정보의 해시(등급+출처+영문명+발매년월)를 저장
// 오탐이거나 이미 제품으로 등록해서 더 이상 후보로 볼 필요가 없는 항목을 다시 노출하지 않기 위한 용도
@Entity
@Table(name = "product_release_check")
class ProductReleaseCheck(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    @Column(nullable = false, unique = true)
    var hash: String,
    @Column(name = "created_at", nullable = false)
    var createdAt: LocalDateTime = LocalDateTime.now(ZoneOffset.UTC),
)
