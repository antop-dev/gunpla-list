package ai.antop.gunpla.bnkrmall.dto

import java.math.BigDecimal

// 반다이남코코리아몰(bnkrmall.co.kr) 등급별 목록(HG/RG/MG/PG) + 프리미엄반다이 스크래핑 결과
// status 는 "판매중"/"예약판매"/"품절" 중 하나 (한국어 그대로, 별도 i18n 없음 — 어드민 페이지 관례)
data class BnkrmallProductDto(
    val grade: String,
    val name: String,
    val status: String,
    val price: BigDecimal?,
    val url: String,
    val imageUrl: String?,
)
