package ia.antop.gunpla.common.config

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
        val cacheControl = CacheControl.maxAge(24, TimeUnit.HOURS)
        registry
            .addResourceHandler("/box-art/original/**")
            .addResourceLocations("file:${appProperties.boxArt.originalDirectory}/")
            .setCacheControl(cacheControl)
        registry
            .addResourceHandler("/box-art/thumbnail/**")
            .addResourceLocations("file:${appProperties.boxArt.thumbnailDirectory}/")
            .setCacheControl(cacheControl)
    }
}
