package ai.antop.gunpla.onsale.service

import ai.antop.gunpla.common.shorty.UrlShortenerService
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
    private val urlShortenerService: UrlShortenerService,
) {
    @Transactional
    fun upsertAll(scraped: List<OnSaleProductDto>) {
        val now = LocalDateTime.now(ZoneOffset.UTC)
        scraped.forEach { dto ->
            val hash = computeHash(dto.source, dto.grade, dto.name)
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
                        // 상품 링크는 신규 등록 시에만 Shorty 짧은 URL 로 변환해 저장한다
                        url = urlShortenerService.shorten(dto.url) ?: dto.url,
                        imageUrl = dto.imageUrl,
                        isReservation = dto.isReservation,
                        newSince = now,
                        createdAt = now,
                        updatedAt = now,
                    ),
                )
            } else {
                if (existing.status == OnSaleProductDto.STATUS_SOLD_OUT && dto.status == OnSaleProductDto.STATUS_ON_SALE) {
                    existing.newSince = now
                }
                existing.status = dto.status
                existing.price = dto.price
                // url 은 갱신하지 않는다 — 이미 저장된 짧은 URL 을 매 배치마다 원본 URL 로 덮어쓰지 않기 위함
                existing.imageUrl = dto.imageUrl
                existing.isReservation = dto.isReservation
            }
        }
    }

    // 같은 제품은 매 배치마다 같은 해시가 나와야 하므로 원문 필드(source+grade+name)만 사용
    private fun computeHash(
        source: String,
        grade: String,
        name: String,
    ): String {
        val raw = "$source|$grade|$name"
        val digest = MessageDigest.getInstance("SHA-256").digest(raw.toByteArray(StandardCharsets.UTF_8))
        return digest.joinToString("") { "%02x".format(it) }
    }
}
