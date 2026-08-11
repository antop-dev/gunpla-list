package ai.antop.gunpla.onsale.dto

import java.math.BigDecimal

// 판매제품 모아보기 — 외부 쇼핑몰(반다이남코코리아몰, 네이버+ 스토어, 프리미엄반다이 미국 등)에서 스크래핑한 건프라 판매 제품 결과
// source 는 "반다이남코코리아몰"/"네이버+ 스토어"/"프리미엄반다이 미국" 등 수집한 사이트 표시용 이름
// status 는 "판매중"/"품절" 중 하나 (한국어 그대로, 별도 i18n 없음 — 사용자 페이지 관례)
// currency 는 price 의 통화 코드("KRW"/"USD") — 국내몰은 KRW, 해외몰(프리미엄반다이 미국)은 USD
data class OnSaleProductDto(
    val source: String,
    val grade: String,
    val name: String,
    val status: String,
    val price: BigDecimal?,
    val currency: String = CURRENCY_KRW,
    val url: String,
    val imageUrl: String?,
) {
    companion object {
        const val STATUS_ON_SALE = "판매중"
        const val STATUS_SOLD_OUT = "품절"
        const val CURRENCY_KRW = "KRW"
        const val CURRENCY_USD = "USD"
    }
}
