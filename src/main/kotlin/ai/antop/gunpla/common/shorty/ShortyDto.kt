package ai.antop.gunpla.common.shorty

// POST /api/v1/links 요청 본문
data class ShortyLinkRequest(
    val url: String,
)

// POST /api/v1/links 응답 본문 — shortUrl 만 저장에 사용하고 나머지는 로깅/디버깅용
data class ShortyLinkResponse(
    val code: String? = null,
    val shortUrl: String? = null,
    val targetUrl: String? = null,
)
