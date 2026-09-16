package ai.antop.gunpla.productrequest.repository

import ai.antop.gunpla.productrequest.entity.ProductRequest
import ai.antop.gunpla.productrequest.entity.ProductRequestStatus
import org.springframework.data.jpa.repository.JpaRepository

interface ProductRequestRepository : JpaRepository<ProductRequest, Long> {
    // 요청 현황 페이지 — 내가 올린 요청을 최신순으로
    fun findByUserIdOrderByCreatedAtDesc(userId: Long): List<ProductRequest>

    // 어드민 목록 — 상태 필터 유무에 따라 두 가지를 사용
    fun findByStatusOrderByCreatedAtDesc(status: ProductRequestStatus): List<ProductRequest>

    fun findAllByOrderByCreatedAtDesc(): List<ProductRequest>

    // 어드민 헤더의 미처리 건수 뱃지용
    fun countByStatus(status: ProductRequestStatus): Long
}
