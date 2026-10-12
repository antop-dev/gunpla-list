package ai.antop.gunpla.onsale.service

import ai.antop.gunpla.onsale.dto.OnSaleProductDto

// 외부 쇼핑몰에서 건프라 판매 제품 목록을 수집하는 스크래퍼 추상화
// 사이트가 추가될 때마다 이 인터페이스를 구현한 @Service 빈(+@Order 로 노출 순서 지정)을 추가하면
// OnSaleSyncService 가 Spring DI(List<OnSaleScraperService>)로 자동으로 모아 배치 적재에 사용한다
interface OnSaleScraperService {
    // 출처 표시 이름 — 수집한 DTO 의 source 와 같은 값. 스크래핑 이력(on_sale_scrape_log)도 이 이름으로 남긴다
    val sourceName: String

    // 실패 시 예외를 던져야 한다 — 예외 없이 빈 목록을 돌려주면 이력에 FAILED 가 아닌 EMPTY 로 기록된다
    fun scrapeAll(): List<OnSaleProductDto>
}
