package ai.antop.gunpla.productrelease.dto

// 반다이 WEB 취급설명서 1건 — 상세 페이지에서 읽어온 매뉴얼 PDF 정보
// number 는 PDF 파일명(첫 매뉴얼은 "1100", 두 번째는 "1100_2")으로 그리드에 그대로 노출되는 표시용 값
data class ManualLinkDto(
    val number: String,
    val label: String,
    val pdfUrl: String,
)
