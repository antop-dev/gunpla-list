package ai.antop.gunpla.onsale.service

import ai.antop.gunpla.onsale.dto.OnSaleProductDto
import ai.antop.gunpla.onsale.entity.OnSaleProduct
import ai.antop.gunpla.onsale.repository.OnSaleProductRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Duration
import java.time.LocalDateTime
import java.time.ZoneOffset

// 판매제품 모아보기 조회 — on_sale_product 테이블을 그대로 조회해 반환 (매 요청마다 대상 사이트를 스크래핑하지 않음)
// 실제 스크래핑/DB 적재는 OnSaleSyncService 가 서버 기동 직후 + 10분 간격 배치로 수행
@Service
class OnSaleService(
    private val onSaleProductRepository: OnSaleProductRepository,
) {
    @Transactional(readOnly = true)
    fun findAll(): List<OnSaleProductDto> {
        val now = LocalDateTime.now(ZoneOffset.UTC)
        return onSaleProductRepository.findAllByOrderBySourceAscGradeAscNameAsc().map { it.toDto(now) }
    }

    // newSince 로부터 2일이 지나지 않았으면 "NEW" 라벨 대상
    private fun OnSaleProduct.toDto(now: LocalDateTime): OnSaleProductDto =
        OnSaleProductDto(
            source = source,
            grade = grade,
            name = name,
            status = status,
            price = price,
            currency = currency,
            url = url,
            imageUrl = imageUrl,
            isReservation = isReservation,
            isNew = Duration.between(newSince, now) < NEW_LABEL_WINDOW,
        )

    companion object {
        private val NEW_LABEL_WINDOW = Duration.ofDays(2)
    }
}
