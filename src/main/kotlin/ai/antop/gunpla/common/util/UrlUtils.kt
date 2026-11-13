package ai.antop.gunpla.common.util

import ai.antop.gunpla.common.exception.BadRequestException
import java.net.URI

object UrlUtils {
    // 사용자 입력 URL 은 화면에서 <a href> 로 출력되므로 http/https 만 허용한다 (javascript:, data: 등 차단)
    fun requireHttpUrl(
        url: String?,
        fieldName: String,
    ) {
        val value = url?.trim()?.takeIf { it.isNotBlank() } ?: return
        val scheme = runCatching { URI(value).scheme?.lowercase() }.getOrNull()
        if (scheme != "http" && scheme != "https") {
            throw BadRequestException("$fieldName 은(는) http(s) 주소만 입력할 수 있습니다.")
        }
    }

    fun requireHttpUrls(
        urls: List<String>,
        fieldName: String,
    ) = urls.forEach { requireHttpUrl(it, fieldName) }
}
