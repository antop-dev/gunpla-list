package ia.antop.gunpla.common.config

import org.springframework.boot.context.properties.ConfigurationProperties

// application.yml 의 app.* 설정을 바인딩하는 타입-안전 설정 클래스
@ConfigurationProperties(prefix = "app")
data class AppProperties(
    val baseUrl: String = "http://localhost:8080",
    val boxArt: BoxArtProperties = BoxArtProperties(),
    /** Google Analytics 4 측정 ID (application.yml에서 설정, 미설정 시 GA4 비활성) */
    val ga4: String?,
    /** Google Tag Manager ID (application.yml에서 설정, 미설정 시 GTM 비활성) */
    val gtmId: String?,
) {
    // 박스아트 파일 저장 경로 — 상대경로면 JVM 실행 디렉토리 기준으로 해석됨
    data class BoxArtProperties(
        val originalDirectory: String = "./data/boxart/original",
        val thumbnailDirectory: String = "./data/boxart/thumbnail",
    )
}
