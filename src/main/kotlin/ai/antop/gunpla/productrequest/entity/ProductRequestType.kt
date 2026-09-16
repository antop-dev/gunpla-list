package ai.antop.gunpla.productrequest.entity

// 요청 종류 — 신규 제품 등록 요청과 기존 제품 수정 요청을 한 테이블에서 구분한다
enum class ProductRequestType {
    REGISTER,
    MODIFY,
}
