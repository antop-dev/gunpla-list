package ai.antop.gunpla.onsale.entity

// 출처별 스크래핑 결과
// EMPTY 는 예외 없이 끝났지만 0건인 경우 — 사이트 구조가 바뀌어 셀렉터가 아무것도 못 찾는 경우가 대부분이라 실패와 같이 경고로 취급한다
enum class OnSaleScrapeStatus {
    SUCCESS,
    EMPTY,
    FAILED,
}
