package ia.antop.gunpla.common.config

import org.springframework.boot.context.properties.ConfigurationProperties

@ConfigurationProperties(prefix = "app")
data class AppProperties(
    val baseUrl: String = "http://localhost:8080",
    val boxArt: BoxArtProperties = BoxArtProperties(),
) {
    data class BoxArtProperties(
        val originalDirectory: String = "./data/boxart/original",
        val thumbnailDirectory: String = "./data/boxart/thumbnail",
    )
}
