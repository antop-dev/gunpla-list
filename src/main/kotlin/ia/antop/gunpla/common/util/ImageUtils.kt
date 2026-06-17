package ia.antop.gunpla.common.util

import io.github.oshai.kotlinlogging.KotlinLogging
import org.imgscalr.Scalr
import java.awt.Color
import java.awt.image.BufferedImage
import java.nio.file.Path
import javax.imageio.ImageIO

private val log = KotlinLogging.logger {}

object ImageUtils {
    fun createThumbnail(
        input: Path,
        output: Path,
    ) {
        log.debug { "createThumbnail: input=$input, output=$output" }
        val source =
            ImageIO.read(input.toFile())
                ?: throw IllegalArgumentException("Cannot read image: $input")
        log.debug { "createThumbnail: source=${source.width}x${source.height}, type=${source.type}" }
        val thumbnail = Scalr.resize(source, Scalr.Method.QUALITY, Scalr.Mode.AUTOMATIC, 100, 50)
        log.debug { "createThumbnail: resized to ${thumbnail.width}x${thumbnail.height}" }
        val rgb = toRgb(thumbnail)
        ImageIO.write(rgb, "jpg", output.toFile())
        log.debug { "createThumbnail: written to $output" }
    }

    private fun toRgb(image: BufferedImage): BufferedImage {
        if (image.type == BufferedImage.TYPE_INT_RGB) return image
        val rgb = BufferedImage(image.width, image.height, BufferedImage.TYPE_INT_RGB)
        val g = rgb.createGraphics()
        g.drawImage(image, 0, 0, Color.WHITE, null)
        g.dispose()
        return rgb
    }
}
