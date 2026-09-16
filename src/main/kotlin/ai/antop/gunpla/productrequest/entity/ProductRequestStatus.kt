package ai.antop.gunpla.productrequest.entity

// 요청 처리 상태 — 관리자가 승인(APPROVED)/반려(REJECTED) 하거나 요청자가 취소(CANCELED) 할 때까지 PENDING 으로 남는다
// PENDING 이 아닌 요청은 더 이상 내용을 바꿀 수 없고 이력으로만 조회된다
enum class ProductRequestStatus {
    PENDING,
    APPROVED,
    REJECTED,
    CANCELED,
}
