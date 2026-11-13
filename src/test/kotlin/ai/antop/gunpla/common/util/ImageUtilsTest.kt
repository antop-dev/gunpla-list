package ai.antop.gunpla.common.util

import ai.antop.gunpla.common.exception.BadRequestException
import java.awt.image.BufferedImage
import java.io.ByteArrayOutputStream
import javax.imageio.ImageIO
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class ImageUtilsTest {
    private fun encode(
        format: String,
        width: Int = 10,
        height: Int = 10,
    ): ByteArray {
        val output = ByteArrayOutputStream()
        ImageIO.write(BufferedImage(width, height, BufferedImage.TYPE_INT_RGB), format, output)
        return output.toByteArray()
    }

    @Test
    fun `확장자는 파일명이 아니라 실제 포맷으로 정한다`() {
        assertEquals("png", ImageUtils.readImage(encode("png")).extension)
        assertEquals("jpg", ImageUtils.readImage(encode("jpg")).extension)
        assertEquals("gif", ImageUtils.readImage(encode("gif")).extension)
    }

    @Test
    fun `GIF 뒤에 HTML 을 붙인 폴리글랏도 gif 로 저장된다`() {
        val polyglot = encode("gif") + "<script>alert(1)</script>".toByteArray()
        assertEquals("gif", ImageUtils.readImage(polyglot).extension)
    }

    @Test
    fun `이미지가 아니면 거부한다`() {
        assertFailsWith<BadRequestException> { ImageUtils.readImage("<html><script>alert(1)</script></html>".toByteArray()) }
    }

    @Test
    fun `허용하지 않은 포맷은 거부한다`() {
        assertFailsWith<BadRequestException> { ImageUtils.readImage(encode("bmp")) }
    }

    @Test
    fun `픽셀 수가 상한을 넘으면 디코딩하지 않는다`() {
        assertFailsWith<BadRequestException> { ImageUtils.readImage(encode("png", 6000, 6000)) }
    }
}
