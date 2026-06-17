package ia.antop.gunpla.common.config

import org.springframework.boot.context.properties.ConfigurationProperties

// application.yml 의 app.* 설정을 바인딩하는 타입-안전 설정 클래스
@ConfigurationProperties(prefix = "app")
data class AppProperties(
    val baseUrl: String = "http://localhost:8080",
    val boxArt: BoxArtProperties = BoxArtProperties(),
) {
    // 박스아트 파일 저장 경로 — 상대경로면 JVM 실행 디렉토리 기준으로 해석됨
    data class BoxArtProperties(
        val originalDirectory: String = "./data/boxart/original",
        val thumbnailDirectory: String = "./data/boxart/thumbnail",
    )
}
