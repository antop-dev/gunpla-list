package ai.antop.gunpla.common.util

import ai.antop.gunpla.common.exception.BadRequestException
import kotlin.test.Test
import kotlin.test.assertFailsWith

class UrlUtilsTest {
    @Test
    fun `http(s) 와 빈 값은 허용한다`() {
        UrlUtils.requireHttpUrl("https://example.com/a", "URL")
        UrlUtils.requireHttpUrl("HTTP://example.com", "URL")
        UrlUtils.requireHttpUrl(null, "URL")
        UrlUtils.requireHttpUrl(" ", "URL")
    }

    @Test
    fun `javascript, data, 스킴 없는 값은 거부한다`() {
        listOf("javascript:alert(1)", " JavaScript:alert(1)", "data:text/html,x", "example.com", "//evil.com").forEach {
            assertFailsWith<BadRequestException>(it) { UrlUtils.requireHttpUrl(it, "URL") }
        }
    }
}
