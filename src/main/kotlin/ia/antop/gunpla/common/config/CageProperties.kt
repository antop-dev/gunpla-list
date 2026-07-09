package ia.antop.gunpla.common.config

import org.springframework.boot.context.properties.ConfigurationProperties

// application.yml 의 cage.* 설정을 바인딩하는 타입-안전 설정 클래스
@ConfigurationProperties(prefix = "cage")
data class CageProperties(
    // 세션에 캡챠 토큰을 저장할 키 이름 — 환경변수 CAGE_SESSION_KEY 로 재정의 가능
    val sessionKey: String = "CAGE_TOKEN",
)
