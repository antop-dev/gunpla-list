package ai.antop.gunpla.common.config

import org.springframework.boot.context.properties.ConfigurationProperties

// application.yml 의 app.* 설정을 바인딩하는 타입-안전 설정 클래스
@ConfigurationProperties(prefix = "app")
data class AppProperties(
    val baseUrl: String = "http://localhost:8080",
    val boxArt: BoxArtProperties = BoxArtProperties(),
    val mail: MailProperties = MailProperties(),
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

    // 신규 판매제품 알림 메일 발송 설정. SMTP 접속 정보 자체는 표준 spring.mail.* 을 그대로 쓴다
    data class MailProperties(
        /**
         * SMTP 연결 암호화 방식. JavaMail 의 `ssl.enable` / `starttls.enable` / `starttls.required`
         * 세 속성이 이 값 하나에서 함께 결정된다([ai.antop.gunpla.common.config.MailConfig]).
         * 따로 두면 `ssl=true` 인데 `starttls=true` 같은 모순된 조합이 만들어질 수 있다.
         */
        val tls: Tls = Tls.STARTTLS,
        /**
         * 받는 사람에게 보이는 발신 주소. 비어 있으면 `spring.mail.username`(SMTP 계정)을 쓴다.
         * Resend 에서는 도메인 인증이 끝난 주소여야 하며 반드시 지정해야 한다.
         */
        val from: String = "",
        /** 발신자 표시 이름. 비어 있으면 주소만 보인다. */
        val fromName: String = "",
        /** 회신 주소. 비어 있으면 회신은 발신 주소로 간다. */
        val replyTo: String = "",
    ) {
        enum class Tls(
            /** 처음부터 TLS 로 연결한다(SMTPS). */
            val implicitSsl: Boolean,
            /** 평문으로 붙은 뒤 TLS 로 승격한다. */
            val startTls: Boolean,
        ) {
            /** 587 표준. 승격에 실패하면 발송하지 않는다. */
            STARTTLS(implicitSsl = false, startTls = true),

            /** 465 암시적 TLS. */
            SSL(implicitSsl = true, startTls = false),

            /** 암호화 없음(평문). STARTTLS 를 지원하지 않는 로컬 더미 SMTP(mailpit 등) 전용. */
            NONE(implicitSsl = false, startTls = false),
        }
    }
}
