package ai.antop.gunpla.common.util

import io.github.oshai.kotlinlogging.KotlinLogging
import org.imgscalr.Scalr
import java.awt.Color
import java.awt.image.BufferedImage
import java.io.ByteArrayOutputStream
import java.nio.file.Path
import javax.imageio.ImageIO

private val log = KotlinLogging.logger {}

object ImageUtils {
    // 썸네일 크기: 100×50 px JPEG (어드민 목록에서 미리보기용)
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
        // JPEG 는 투명도를 지원하지 않으므로 PNG 알파 채널을 흰색 배경으로 변환
        val rgb = toRgb(thumbnail)
        ImageIO.write(rgb, "jpg", output.toFile())
        log.debug { "createThumbnail: written to $output" }
    }

    // 알파 채널(투명도)이 있는 이미지를 흰색 배경의 RGB 이미지로 변환
    private fun toRgb(image: BufferedImage): BufferedImage {
        if (image.type == BufferedImage.TYPE_INT_RGB) return image
        val rgb = BufferedImage(image.width, image.height, BufferedImage.TYPE_INT_RGB)
        val g = rgb.createGraphics()
        g.drawImage(image, 0, 0, Color.WHITE, null)
        g.dispose()
        return rgb
    }

    // 상하좌우 가장자리의 흰(또는 near-white) 여백을 잘라낸다. 전체가 흰색이면 원본 그대로 반환
    // threshold 기본값 180: JPEG 압축으로 흰 배경과 실제 콘텐츠 경계에 생기는 링잉 아티팩트, 살짝 누렇거나 회색 도는
    // near-white 배경까지 폭넓게 흰색으로 흡수해 여백을 확실히 제거하도록 여유 있게 잡은 값
    fun trimWhitespace(
        source: BufferedImage,
        threshold: Int = 180,
    ): BufferedImage {
        val width = source.width
        val height = source.height

        fun isWhitePixel(rgb: Int): Boolean {
            val r = (rgb shr 16) and 0xFF
            val g = (rgb shr 8) and 0xFF
            val b = rgb and 0xFF
            return r >= threshold && g >= threshold && b >= threshold
        }

        fun isWhiteRow(y: Int) = (0 until width).all { x -> isWhitePixel(source.getRGB(x, y)) }

        fun isWhiteCol(x: Int) = (0 until height).all { y -> isWhitePixel(source.getRGB(x, y)) }

        var top = 0
        while (top < height && isWhiteRow(top)) top++
        var bottom = height - 1
        while (bottom > top && isWhiteRow(bottom)) bottom--
        var left = 0
        while (left < width && isWhiteCol(left)) left++
        var right = width - 1
        while (right > left && isWhiteCol(right)) right--

        if (top >= bottom || left >= right) return source

        return source.getSubimage(left, top, right - left + 1, bottom - top + 1)
    }

    // 흰 여백을 잘라낸 뒤 JPEG 바이트로 인코딩
    fun trimWhitespaceToJpegBytes(
        source: BufferedImage,
        threshold: Int = 180,
    ): ByteArray {
        val trimmed = trimWhitespace(source, threshold)
        val rgb = toRgb(trimmed)
        val output = ByteArrayOutputStream()
        ImageIO.write(rgb, "jpg", output)
        return output.toByteArray()
    }
}
