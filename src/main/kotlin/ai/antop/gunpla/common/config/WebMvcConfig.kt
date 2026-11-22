package ai.antop.gunpla.common.config

import org.springframework.context.annotation.Configuration
import org.springframework.http.CacheControl
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer
import java.util.concurrent.TimeUnit

@Configuration
class WebMvcConfig(
    private val appProperties: AppProperties,
) : WebMvcConfigurer {
    override fun addResourceHandlers(registry: ResourceHandlerRegistry) {
        // 서비스워커 킬 스위치 — 브라우저가 캐시된 옛 버전을 쓰지 않고 항상 네트워크로 재검증하도록 함
        registry
            .addResourceHandler("/sw.js")
            .addResourceLocations("classpath:/static/")
            .setCacheControl(CacheControl.noCache())

        // 박스아트 파일명은 UUID 라 같은 URL 의 내용이 바뀌지 않으므로 1년 동안 재검증 없이 캐시한다
        val cacheControl = CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic().immutable()
        registry
            .addResourceHandler("/box-art/original/**")
            .addResourceLocations("file:${appProperties.boxArt.originalDirectory}/")
            .setCacheControl(cacheControl)
        registry
            .addResourceHandler("/box-art/thumbnail/**")
            .addResourceLocations("file:${appProperties.boxArt.thumbnailDirectory}/")
            .setCacheControl(cacheControl)
        registry
            .addResourceHandler("/box-art/medium/**")
            .addResourceLocations("file:${appProperties.boxArt.mediumDirectory}/")
            .setCacheControl(cacheControl)
    }
}
