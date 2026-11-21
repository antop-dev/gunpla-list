package ai.antop.gunpla.onsale.service

import ai.antop.gunpla.onsale.dto.OnSaleProductDto
import ai.antop.gunpla.onsale.entity.OnSaleProduct
import ai.antop.gunpla.onsale.repository.OnSaleProductRepository
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.time.LocalDateTime
import java.time.ZoneOffset

// OnSaleSyncService 에서 분리 — 같은 클래스 안에서 this.upsertAll(...) 로 호출하면 Spring AOP 프록시를
// 거치지 않아 @Transactional 이 적용되지 않으므로(self-invocation), 별도 빈으로 분리해 프록시를 통해 호출되도록 함
@Service
class OnSaleUpsertService(
    private val onSaleProductRepository: OnSaleProductRepository,
) {
    // 반환값은 이번 배치에서 새로 "판매중"이 된 제품(신규 등록 또는 품절→판매중 전환) — OnSaleNotificationService 의 이메일 발송 대상
    @Transactional
    fun upsertAll(scraped: List<OnSaleProductDto>): List<OnSaleProductDto> {
        val now = LocalDateTime.now(ZoneOffset.UTC)
        val newlyOnSale = mutableListOf<OnSaleProductDto>()
        scraped.forEach { dto ->
            val hash = computeHash(dto)
            val existing = onSaleProductRepository.findByIdOrNull(hash)
            if (existing == null) {
                onSaleProductRepository.save(
                    OnSaleProduct(
                        hash = hash,
                        source = dto.source,
                        grade = dto.grade,
                        name = dto.name,
                        status = dto.status,
                        price = dto.price,
                        currency = dto.currency,
                        url = dto.url,
                        imageUrl = dto.imageUrl,
                        isReservation = dto.isReservation,
                        newSince = now,
                        createdAt = now,
                        updatedAt = now,
                    ),
                )
                if (dto.status == OnSaleProductDto.STATUS_ON_SALE) newlyOnSale += dto.copy(hash = hash)
            } else {
                if (existing.status == OnSaleProductDto.STATUS_SOLD_OUT && dto.status == OnSaleProductDto.STATUS_ON_SALE) {
                    existing.newSince = now
                    newlyOnSale += dto.copy(hash = hash)
                }
                existing.status = dto.status
                existing.price = dto.price
                // 예전에 Shorty 짧은 URL 로 저장된 링크도 원본 URL 로 되돌린다
                existing.url = dto.url
                existing.imageUrl = dto.imageUrl
                existing.isReservation = dto.isReservation
            }
        }
        return newlyOnSale
    }

    // 같은 제품은 매 배치마다 같은 해시가 나와야 하므로 원문 필드(source+grade+name)만 사용
    private fun computeHash(dto: OnSaleProductDto): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(dto.url.toByteArray(StandardCharsets.UTF_8))
        return digest.joinToString("") { "%02x".format(it) }
    }
}
