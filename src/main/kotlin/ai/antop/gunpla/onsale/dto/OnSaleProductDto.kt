package ai.antop.gunpla.onsale.dto

import java.math.BigDecimal
import java.time.LocalDateTime

// 판매제품 모아보기 — 외부 쇼핑몰(반다이남코코리아몰, 네이버+ 스토어, 프리미엄반다이 미국 등)에서 스크래핑해 DB에 적재된 건프라 판매 제품
// source 는 "반다이남코코리아몰"/"네이버+ 스토어"/"프리미엄반다이 미국" 등 수집한 사이트 표시용 이름
// status 는 "판매중"/"품절" 중 하나 (한국어 그대로, 별도 i18n 없음 — 사용자 페이지 관례)
// currency 는 price 의 통화 코드("KRW"/"USD") — 국내몰은 KRW, 해외몰(프리미엄반다이 미국)은 USD
// isReservation 은 사전예약 제품 여부 — 현재는 PREMIUM BANDAI(PBandaiScraperService)만 판별 가능하고
// 나머지 스크래퍼는 판별 불가하여 기본값 false 로 둠
// isNew 는 최초 등록 또는 품절→판매중 전환 후 2일 이내인지 여부 (OnSaleService 에서 계산)
// newSince 는 그 판정 기준 시각(UTC) — 화면에서 "최근 갱신순" 정렬에 사용
// (스크래퍼가 만드는 DTO 에는 아직 값이 없어 null, 조회 응답(OnSaleService)에서만 DB 값으로 채워짐)
data class OnSaleProductDto(
    val source: String,
    val grade: String,
    val name: String,
    val status: String,
    val price: BigDecimal?,
    val currency: String = CURRENCY_KRW,
    val url: String,
    val imageUrl: String?,
    val isReservation: Boolean = false,
    val isNew: Boolean = false,
    val newSince: LocalDateTime? = null,
) {
    companion object {
        const val STATUS_ON_SALE = "판매중"
        const val STATUS_SOLD_OUT = "품절"
        const val CURRENCY_KRW = "KRW"
        const val CURRENCY_USD = "USD"
    }
}
