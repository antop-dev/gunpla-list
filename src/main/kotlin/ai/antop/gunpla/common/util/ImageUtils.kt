package ai.antop.gunpla.common.util

import ai.antop.gunpla.common.exception.BadRequestException
import io.github.oshai.kotlinlogging.KotlinLogging
import org.imgscalr.Scalr
import java.awt.Color
import java.awt.image.BufferedImage
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.nio.file.Path
import javax.imageio.ImageIO

private val log = KotlinLogging.logger {}

object ImageUtils {
    // 업로드 허용 포맷(ImageIO formatName 소문자) → 저장 확장자
    // 파일명 확장자는 클라이언트가 마음대로 정할 수 있으므로(.html 등) 믿지 않고, 실제 내용으로 판별한 포맷만 쓴다
    private val ALLOWED_FORMATS = mapOf("jpeg" to "jpg", "png" to "png", "gif" to "gif", "webp" to "webp")

    // 디컴프레션 폭탄 방지 — 헤더의 가로×세로가 이 값을 넘으면 디코딩하지 않는다 (2,500만 px ≈ ARGB 100MB)
    private const val MAX_PIXELS = 25_000_000L

    data class DetectedImage(
        val image: BufferedImage,
        // 실제 포맷 기준 저장 확장자 (jpg/png/gif/webp)
        val extension: String,
    )

    // 바이트를 이미지로 디코딩한다 — 허용 포맷이 아니거나 너무 크면 BadRequestException
    fun readImage(bytes: ByteArray): DetectedImage {
        val input =
            ImageIO.createImageInputStream(ByteArrayInputStream(bytes))
                ?: throw BadRequestException("이미지를 읽을 수 없습니다.")
        input.use {
            val reader =
                ImageIO.getImageReaders(input).asSequence().firstOrNull()
                    ?: throw BadRequestException("이미지 파일만 업로드할 수 있습니다.")
            try {
                reader.setInput(input, true, true)
                val extension =
                    ALLOWED_FORMATS[reader.formatName.lowercase()]
                        ?: throw BadRequestException("JPG, PNG, GIF, WEBP 이미지만 업로드할 수 있습니다.")
                val width = reader.getWidth(0)
                val height = reader.getHeight(0)
                if (width.toLong() * height > MAX_PIXELS) {
                    throw BadRequestException("이미지가 너무 큽니다. (${width}x$height)")
                }
                return DetectedImage(reader.read(0), extension)
            } finally {
                reader.dispose()
            }
        }
    }

    // 썸네일 크기: 100×50 px JPEG (어드민 목록에서 미리보기용)
    fun createThumbnail(
        input: Path,
        output: Path,
    ) {
        log.debug { "createThumbnail: input=$input, output=$output" }
        val source =
            ImageIO.read(input.toFile())
                ?: throw IllegalArgumentException("Cannot read image: $input")
        createThumbnail(source, output)
    }

    fun createThumbnail(
        source: BufferedImage,
        output: Path,
    ) {
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
