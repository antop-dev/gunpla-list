package ia.antop.gunpla.common.config

import org.slf4j.LoggerFactory
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component
import java.nio.file.Files
import java.nio.file.Path

@Component
class DataInitializer(
    private val appProperties: AppProperties,
) {
    private val log = LoggerFactory.getLogger(this::class.java)

    @EventListener(ApplicationReadyEvent::class)
    fun init() {
        val origDir = Path.of(appProperties.boxArt.originalDirectory).toAbsolutePath()
        val thumbDir = Path.of(appProperties.boxArt.thumbnailDirectory).toAbsolutePath()
        Files.createDirectories(origDir)
        Files.createDirectories(thumbDir)
        log.info("BoxArt directories ready: original={}, thumbnail={}", origDir, thumbDir)
    }
}
