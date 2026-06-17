package ia.antop.gunpla.common.config

import org.springframework.context.annotation.Configuration
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer

@Configuration
class WebMvcConfig(
    private val appProperties: AppProperties,
) : WebMvcConfigurer {
    override fun addResourceHandlers(registry: ResourceHandlerRegistry) {
        registry
            .addResourceHandler("/box-art/original/**")
            .addResourceLocations("file:${appProperties.boxArt.originalDirectory}/")
        registry
            .addResourceHandler("/box-art/thumbnail/**")
            .addResourceLocations("file:${appProperties.boxArt.thumbnailDirectory}/")
    }
}
