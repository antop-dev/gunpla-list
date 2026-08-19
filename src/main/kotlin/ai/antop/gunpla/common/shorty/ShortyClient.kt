package ai.antop.gunpla.common.shorty

import org.springframework.cloud.openfeign.FeignClient
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody

// Shorty 단축 URL 생성 API 클라이언트
// 베이스 URL 은 shorty.url 설정에서 주입되고, X-Api-Key 헤더는 ShortyFeignConfig 의 인터셉터가 붙인다
@FeignClient(
    name = "shorty",
    url = "\${shorty.url:}",
    configuration = [ShortyFeignConfig::class],
)
interface ShortyClient {
    @PostMapping("/api/v1/links", consumes = ["application/json"], produces = ["application/json"])
    fun createLink(
        @RequestBody request: ShortyLinkRequest,
    ): ShortyLinkResponse
}
