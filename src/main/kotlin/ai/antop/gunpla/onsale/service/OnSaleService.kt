package ai.antop.gunpla.onsale.service

import ai.antop.gunpla.onsale.dto.OnSaleProductDto
import org.springframework.stereotype.Service

// OnSaleScraperService 구현체(반다이남코코리아몰, 네이버+ 스토어 등)를 Spring DI 로 모두 주입받아
// 각 사이트에서 스크래핑한 판매 제품 목록을 이어붙여 반환 — 사이트 순서는 각 구현체의 @Order 값을 따름
// 중복 제거/DB 비교는 하지 않음 — 스크래핑된 전체 목록을 그대로 보여줌
@Service
class OnSaleService(
    private val scraperServices: List<OnSaleScraperService>,
) {
    fun findAll(): List<OnSaleProductDto> = scraperServices.flatMap { it.scrapeAll() }
}
