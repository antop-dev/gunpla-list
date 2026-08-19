package ai.antop.gunpla.common.shorty

import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service

private val log = KotlinLogging.logger {}

// 외부에 노출/저장할 URL 을 Shorty 짧은 URL 로 변환하는 서비스
@Service
class UrlShortenerService(
    private val shortyClient: ShortyClient,
    private val properties: ShortyProperties,
) {
    /**
     * 원본 URL 을 Shorty 짧은 URL 로 변환한다.
     *
     * - 빈 값이면 null 반환
     * - shorty 설정이 없으면 원본 그대로 반환
     * - 이미 Shorty 짧은 URL 이면 재변환하지 않음 (수정 시 중복 단축 방지)
     * - 1초 내에 응답이 없거나(타임아웃), 오류 응답이거나, shortUrl 이 비어 있으면 원본 URL 로 폴백
     *   — 단축 실패 때문에 제품 등록/수정이 막히지 않게 한다 (타임아웃 설정은 [ShortyFeignConfig])
     */
    fun shorten(url: String?): String? {
        val target = url?.trim()?.takeIf { it.isNotBlank() } ?: return null
        if (!properties.enabled) {
            log.debug { "shorten: shorty 설정이 없어 원본 URL 사용 → $target" }
            return target
        }
        if (target.startsWith(properties.url.trimEnd('/'))) {
            log.debug { "shorten: 이미 단축된 URL 이므로 그대로 사용 → $target" }
            return target
        }
        // 타임아웃/연결오류/4xx·5xx 는 모두 예외로 올라오므로 한곳에서 잡아 폴백한다
        val response =
            runCatching { shortyClient.createLink(ShortyLinkRequest(target)) }
                .onFailure { log.warn(it) { "shorten: Shorty 호출 실패, 원본 URL 로 폴백 → $target" } }
                .getOrNull()
                ?: return target

        val shortUrl = response.shortUrl?.trim()?.takeIf { it.isNotBlank() }
        if (shortUrl == null) {
            // HTTP 200 이어도 shortUrl 이 없으면 정상 응답으로 보지 않는다
            log.warn { "shorten: Shorty 응답에 shortUrl 이 없어 원본 URL 로 폴백 → $target (response=$response)" }
            return target
        }
        log.debug { "shorten: $target → $shortUrl" }
        return shortUrl
    }
}
