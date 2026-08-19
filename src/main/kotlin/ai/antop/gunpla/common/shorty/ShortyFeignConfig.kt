package ai.antop.gunpla.common.shorty

import feign.Request
import feign.RequestInterceptor
import feign.Retryer
import org.springframework.context.annotation.Bean
import java.util.concurrent.TimeUnit

// ShortyClient 전용 Feign 설정 — @Configuration 을 붙이지 않아야 전역 Feign 설정으로 새지 않는다
class ShortyFeignConfig {
    @Bean
    fun shortyApiKeyInterceptor(properties: ShortyProperties): RequestInterceptor =
        RequestInterceptor { template ->
            template.header("X-Api-Key", properties.clientKey)
        }

    // 연결/응답 각각 1초 — 단축 URL 은 부가 기능이므로 제품 저장을 오래 붙잡지 않게 한다
    @Bean
    fun shortyRequestOptions(): Request.Options =
        Request.Options(
            TIMEOUT_MILLIS,
            TimeUnit.MILLISECONDS,
            TIMEOUT_MILLIS,
            TimeUnit.MILLISECONDS,
            true,
        )

    // 재시도하면 1초 제한이 사실상 N배가 되므로 재시도 없이 즉시 폴백시킨다
    @Bean
    fun shortyRetryer(): Retryer = Retryer.NEVER_RETRY

    companion object {
        private const val TIMEOUT_MILLIS = 1_000L
    }
}
