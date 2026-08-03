package ai.antop.gunpla.productrelease.service

import java.math.BigDecimal

// 제품 출시 정보 한 건 — 스크래퍼가 채워서 반환 (파싱은 ProductReleaseService 에서 수행)
// source 는 어느 스크래퍼(사이트)에서 수집됐는지 나타내는 표시용 이름(예: "gunpla.fyi")
data class ScrapedProductRow(
    val grade: String,
    val source: String,
    val nameKo: String,
    val nameEn: String? = null,
    val nameJp: String? = null,
    val modelNumber: String?,
    val dateText: String?,
    val series: String?,
    val sourceUrl: String,
    val imageUrl: String? = null,
    val price: BigDecimal? = null,
)

// 외부 사이트에서 건프라 상품 목록을 수집하는 스크래퍼 추상화
// 사이트가 추가될 때마다 이 인터페이스를 구현한 @Service 빈을 추가하기만 하면
// ProductReleaseService 가 Spring DI(List<ProductScraperService>)로 자동으로 모아 사용한다
interface ProductScraperService {
    fun scrapeAll(): List<ScrapedProductRow>
}
