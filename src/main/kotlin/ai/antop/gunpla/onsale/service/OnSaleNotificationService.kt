package ai.antop.gunpla.onsale.service

import ai.antop.gunpla.onsale.dto.OnSaleProductDto
import ai.antop.gunpla.user.repository.UserAccountRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

private val log = KotlinLogging.logger {}

// 이번 배치에서 새로 "판매중"이 된 제품을, 알림 수신 동의한 사용자들에게 이메일로 발송 대상을 골라 전달
// 실제 발송(SMTP)은 OnSaleMailService 가 사용자별로 비동기 처리한다
@Service
class OnSaleNotificationService(
    private val userAccountRepository: UserAccountRepository,
    private val onSaleMailService: OnSaleMailService,
) {
    @Transactional(readOnly = true)
    fun notifyNewOnSaleProducts(products: List<OnSaleProductDto>) {
        val recipients = userAccountRepository.findAllByNotifyOnSaleTrue()
        if (recipients.isEmpty()) return

        // 한 배치에서 비정상적으로 많은 수가 감지되면(스크래핑 순간 오류로 대량 오탐 등) 메일이 지나치게 길어지고
        // 스팸처럼 느껴질 수 있어 상위 일부만 담아 보낸다 — DB 갱신 자체는 이 캡과 무관하게 전부 반영된다
        val mailProducts =
            if (products.size > MAX_NOTIFY_ITEMS) {
                log.warn { "on-sale notification: batch too large (${products.size} items), capping to top $MAX_NOTIFY_ITEMS" }
                products.take(MAX_NOTIFY_ITEMS)
            } else {
                products
            }

        recipients.forEach { user ->
            // notifyEmail 이 비어 있으면 구글 로그인 이메일로 대신 보낸다(알림 설정 화면의 기본값과 동일한 규칙)
            val email = user.notifyEmail?.takeIf { it.isNotBlank() } ?: user.email
            if (email.isNullOrBlank()) {
                log.warn { "on-sale notification skipped: no email for user id=${user.id}" }
                return@forEach
            }
            onSaleMailService.sendNewOnSaleMail(email, mailProducts)
        }
    }

    companion object {
        private const val MAX_NOTIFY_ITEMS = 10
    }
}
