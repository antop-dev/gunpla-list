package ai.antop.gunpla.onsale.service

import ai.antop.gunpla.onsale.dto.OnSaleProductDto
import ai.antop.gunpla.onsale.repository.OnSaleAlertOffRepository
import ai.antop.gunpla.user.repository.UserAccountRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

private val log = KotlinLogging.logger {}

// 이번 배치에서 새로 "판매중"이 된 제품 중, 사용자별로 아래 세 조건을 모두 만족하는 제품만 이메일로 전달
//  1) 설정에서 알림 수신에 동의했다 (notifyOnSale)
//  2) 그 제품의 등급을 알림 받을 등급으로 골랐다 (notifyGrades)
//  3) 판매제품 모아보기에서 그 제품의 알림을 끄지 않았다 (제품별 알림은 기본 켬 — 끈 제품만 on_sale_alert_off 에 있음)
//     새로 등록된 제품은 아직 아무도 끄지 않았으므로 기본으로 알림 대상이다
// 실제 발송(SMTP)은 OnSaleMailService 가 사용자별로 비동기 처리한다
@Service
class OnSaleNotificationService(
    private val userAccountRepository: UserAccountRepository,
    private val onSaleAlertOffRepository: OnSaleAlertOffRepository,
    private val onSaleMailService: OnSaleMailService,
) {
    @Transactional(readOnly = true)
    fun notifyNewOnSaleProducts(products: List<OnSaleProductDto>) {
        // SQLite 바인딩 변수 수 제한(999)을 넘지 않도록 나눠서 조회
        val offHashesByUser =
            products
                .mapNotNull { it.hash }
                .chunked(HASH_QUERY_CHUNK)
                .flatMap { onSaleAlertOffRepository.findAllByProductHashIn(it) }
                .groupBy({ it.userId }, { it.productHash })
                .mapValues { (_, hashes) -> hashes.toSet() }
        val recipients = userAccountRepository.findAllByNotifyOnSaleTrue()
        if (recipients.isEmpty()) return

        recipients.forEach { user ->
            // recipients 가 이미 1)을 만족하므로 2) 등급과 3) 제품 알림만 확인
            val off = offHashesByUser[user.id].orEmpty()
            val matched = products.filter { it.grade in user.notifyGrades && it.hash !in off }
            if (matched.isEmpty()) return@forEach

            // notifyEmail 이 비어 있으면 구글 로그인 이메일로 대신 보낸다(알림 설정 화면의 기본값과 동일한 규칙)
            val email = user.notifyEmail?.takeIf { it.isNotBlank() } ?: user.email
            if (email.isNullOrBlank()) {
                log.warn { "on-sale notification skipped: no email for user id=${user.id}" }
                return@forEach
            }

            // 한 배치에서 비정상적으로 많은 수가 감지되면(스크래핑 순간 오류로 대량 오탐 등) 메일이 지나치게 길어지고
            // 스팸처럼 느껴질 수 있어 상위 일부만 담아 보낸다 — DB 갱신 자체는 이 캡과 무관하게 전부 반영된다
            val mailProducts =
                if (matched.size > MAX_NOTIFY_ITEMS) {
                    log.warn {
                        "on-sale notification: too many items (${matched.size}) for user id=${user.id}, capping to top $MAX_NOTIFY_ITEMS"
                    }
                    matched.take(MAX_NOTIFY_ITEMS)
                } else {
                    matched
                }
            onSaleMailService.sendNewOnSaleMail(email, mailProducts)
        }
    }

    companion object {
        private const val MAX_NOTIFY_ITEMS = 10
        private const val HASH_QUERY_CHUNK = 500
    }
}
