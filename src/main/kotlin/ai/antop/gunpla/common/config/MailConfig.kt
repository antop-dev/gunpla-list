package ai.antop.gunpla.common.config

import org.slf4j.LoggerFactory
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.mail.autoconfigure.MailProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.mail.javamail.JavaMailSender
import org.springframework.mail.javamail.JavaMailSenderImpl
import java.util.Properties

// 메일 발송기를 직접 만든다(빈이 있으면 스프링 부트 자동 설정은 물러난다)
// 이유: 연결 암호화 JavaMail 속성 세 개(ssl.enable/starttls.enable/starttls.required)를 설정 파일에서
// 따로 받으면 모순된 조합(ssl=true 인데 starttls=true)이나, starttls.enable 만 켜져 승격 실패 시
// 평문으로 나가버리는 조합이 만들어질 수 있다. 그래서 app.mail.tls 모드 하나에서 세 값을 함께 파생시킨다
@Configuration
@EnableConfigurationProperties(MailProperties::class)
class MailConfig {
    private val log = LoggerFactory.getLogger(javaClass)

    @Bean
    fun javaMailSender(
        mailProperties: MailProperties,
        appProperties: AppProperties,
    ): JavaMailSender {
        val tls = appProperties.mail.tls
        if (tls == AppProperties.MailProperties.Tls.NONE) {
            log.warn("SMTP TLS is disabled (app.mail.tls=NONE). Mail will be sent in plain text - local use only.")
        } else {
            log.info("SMTP TLS mode: {} ({}:{})", tls, mailProperties.host, mailProperties.port)
        }

        return JavaMailSenderImpl().apply {
            host = mailProperties.host
            mailProperties.port?.let { port = it }
            username = mailProperties.username
            password = mailProperties.password
            protocol = mailProperties.protocol
            defaultEncoding = mailProperties.defaultEncoding.name()
            javaMailProperties =
                Properties().apply {
                    // 나머지(auth, ssl.protocols, ssl.checkserveridentity 등)는 설정 파일 값을 그대로 쓴다
                    putAll(mailProperties.properties)
                    setProperty("mail.smtp.ssl.enable", tls.implicitSsl.toString())
                    setProperty("mail.smtp.starttls.enable", tls.startTls.toString())
                    // enable 과 항상 같이 간다. required 만 꺼두면 승격에 실패해도 평문으로 보내버린다
                    setProperty("mail.smtp.starttls.required", tls.startTls.toString())
                }
        }
    }
}
