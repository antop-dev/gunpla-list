package ai.antop.gunpla.productrelease.dto

import java.math.BigDecimal

// gunpla.fyi + 반다이 하비 글로벌 발매 스케줄에서 스크래핑한 제품 출시 정보 응답 DTO (DB 제품 목록과의 비교는 하지 않음)
// nameKo 는 소스에 따라 gunpla.fyi 의 일본어 이름을 번역한 값이거나 반다이 하비 글로벌의 한국어 원문
// nameEn/nameJp 는 소스 원문(간혹 누락되면 null), price 는 반다이 하비 글로벌에서만 제공(엔화, 없으면 null)
// hash 는 등급+출처+영문명+발매년월을 해싱한 값 — 확인완료 토글(체크/해제) API 호출 시 이 값으로 대상을 식별
// checked 는 hash 가 product_release_check 테이블에 존재하는지 여부(관리자가 "확인완료"로 표시했는지)
data class ProductReleaseResponseDto(
    val grade: String,
    val source: String,
    val hash: String,
    val checked: Boolean,
    val modelNumber: String?,
    val nameKo: String,
    val nameEn: String?,
    val nameJp: String?,
    val releaseYear: Int?,
    val releaseMonth: Int?,
    val series: String?,
    val sourceUrl: String,
    val imageUrl: String?,
    val price: BigDecimal?,
)
