package ai.antop.gunpla.onsale.dto

// 판매제품 모아보기 제품별 알림 — 제품별 알림은 기본 켬이라, 로그인 사용자가 알림을 끈 제품 해시(on_sale_product.hash) 목록만 내려준다
data class OnSaleAlertResponseDto(
    val offHashes: List<String>,
)

// 일괄 알림 켜기/끄기 — enabled = true 면 hashes 를 끈 목록에서 빼고, false 면 끈 목록에 넣는다
data class OnSaleAlertUpdateRequestDto(
    val hashes: List<String>,
    val enabled: Boolean,
)
