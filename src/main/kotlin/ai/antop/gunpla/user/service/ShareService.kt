package ai.antop.gunpla.user.service

import ai.antop.gunpla.common.config.AppProperties
import ai.antop.gunpla.common.exception.NotFoundException
import ai.antop.gunpla.common.shorty.UrlShortenerService
import ai.antop.gunpla.product.dto.ProductResponseDto
import ai.antop.gunpla.product.service.ProductService
import ai.antop.gunpla.user.dto.ShareSettingsDto
import ai.antop.gunpla.user.entity.UserAccount
import ai.antop.gunpla.user.repository.UserAccountRepository
import ai.antop.gunpla.user.repository.UserProductRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.security.SecureRandom
import java.util.Base64

// 보유상품 공유 — 공유 설정 조회/변경과 공유 페이지(/share/{shareId})용 보유 제품 조회
@Service
class ShareService(
    private val userAccountRepository: UserAccountRepository,
    private val userProductRepository: UserProductRepository,
    private val productService: ProductService,
    private val appProperties: AppProperties,
    private val urlShortenerService: UrlShortenerService,
) {
    @Transactional(readOnly = true)
    fun get(googleId: String): ShareSettingsDto = findUser(googleId).toShareDto()

    // 처음 공유를 허용할 때 공유 ID 를 만든다 — 한 번 만든 ID 는 공유를 껐다 켜도 그대로 둔다
    // 공유 URL 은 Shorty 로 단축해 저장한다 — Shorty 가 실패하면(원본 URL 폴백) 저장하지 않고 다음 저장 때 다시 시도한다
    @Transactional
    fun update(
        googleId: String,
        enabled: Boolean,
    ): ShareSettingsDto {
        val user = findUser(googleId)
        user.shareEnabled = enabled
        if (enabled && user.shareId == null) {
            user.shareId = generateShareId()
        }
        if (enabled && user.shareShortUrl == null) {
            val longUrl = user.longShareUrl()!!
            user.shareShortUrl = urlShortenerService.shorten(longUrl)?.takeIf { it != longUrl }
        }
        return user.toShareDto()
    }

    // 공유가 허용된 사용자의 보유 제품 — 공유 ID 가 없거나 공유를 끈 경우 null
    // 정렬: 등급 순(HG → PG, 그 외는 뒤) → 발매년월 → 형식번호
    @Transactional(readOnly = true)
    fun findSharedProducts(shareId: String): List<ProductResponseDto>? {
        val user = userAccountRepository.findByShareId(shareId)?.takeIf { it.shareEnabled } ?: return null
        val ownedIds =
            userProductRepository
                .findAllByUserId(user.id!!)
                .filter { it.owned }
                .map { it.productId }
                .toSet()
        if (ownedIds.isEmpty()) return emptyList()
        return productService
            .search()
            .filter { it.id in ownedIds }
            .sortedWith(
                compareBy<ProductResponseDto> { GRADE_ORDER.indexOf(it.grade).let { i -> if (i < 0) GRADE_ORDER.size else i } }
                    .thenBy(nullsLast()) { it.releaseYear }
                    .thenBy(nullsLast()) { it.releaseMonth }
                    .thenBy(nullsLast()) { it.modelNumber },
            )
    }

    private fun findUser(googleId: String): UserAccount =
        userAccountRepository.findByGoogleId(googleId) ?: throw NotFoundException("User not found")

    private fun UserAccount.longShareUrl(): String? = shareId?.let { "${appProperties.baseUrl.trimEnd('/')}/share/$it" }

    private fun UserAccount.toShareDto() =
        ShareSettingsDto(
            enabled = shareEnabled,
            shareUrl = if (shareEnabled) shareShortUrl ?: longShareUrl() else null,
        )

    // google_id/email 과 무관한 128비트 난수를 URL-safe Base64(22자)로 만든다 — 공유 URL 로 계정을 유추할 수 없다
    private fun generateShareId(): String {
        while (true) {
            val bytes = ByteArray(SHARE_ID_BYTES).also { random.nextBytes(it) }
            val id = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
            if (!userAccountRepository.existsByShareId(id)) return id
        }
    }

    companion object {
        private const val SHARE_ID_BYTES = 16
        private val random = SecureRandom()
        private val GRADE_ORDER = listOf("HG", "RG", "MG", "MGSD", "MGEX", "PG")
    }
}
