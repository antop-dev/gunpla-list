package ai.antop.gunpla.onsale.service

import ai.antop.gunpla.common.config.AppProperties
import ai.antop.gunpla.onsale.dto.OnSaleProductDto
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.ObjectProvider
import org.springframework.boot.mail.autoconfigure.MailProperties
import org.springframework.mail.javamail.JavaMailSender
import org.springframework.mail.javamail.MimeMessageHelper
import org.springframework.scheduling.annotation.Async
import org.springframework.stereotype.Service
import org.thymeleaf.context.Context
import org.thymeleaf.spring6.SpringTemplateEngine
import java.math.BigDecimal
import java.math.RoundingMode
import java.nio.charset.StandardCharsets
import java.text.NumberFormat
import java.util.Locale

private val log = KotlinLogging.logger {}

// 신규 판매제품 알림 메일을 사용자 한 명에게 비동기로 발송한다. 메일 설정이 없으면 조용히 건너뛴다
// 본문은 Thymeleaf 템플릿(templates/mail/on-sale-notification.html)으로 만든다
@Service
class OnSaleMailService(
    private val mailSenderProvider: ObjectProvider<JavaMailSender>,
    private val templateEngine: SpringTemplateEngine,
    private val mailProperties: MailProperties,
    private val appProperties: AppProperties,
) {
    @Async("mailExecutor")
    fun sendNewOnSaleMail(
        toEmail: String,
        products: List<OnSaleProductDto>,
    ) {
        val mailSender = mailSenderProvider.ifAvailable
        val account = mailProperties.username
        if (mailSender == null || mailProperties.host.isNullOrBlank() || account.isNullOrBlank()) {
            log.warn { "Mail is not configured, skipping on-sale notification mail." }
            return
        }
        // 표시용 발신 주소를 따로 지정하지 않았으면 SMTP 계정을 그대로 쓴다
        val from = appProperties.mail.from.ifBlank { account }

        try {
            val message = mailSender.createMimeMessage()
            val helper = MimeMessageHelper(message, false, StandardCharsets.UTF_8.name())
            val fromName = appProperties.mail.fromName
            if (fromName.isBlank()) helper.setFrom(from) else helper.setFrom(from, fromName)
            val replyTo = appProperties.mail.replyTo
            if (replyTo.isNotBlank()) helper.setReplyTo(replyTo)
            helper.setTo(toEmail)
            helper.setSubject("건프라 신규 판매제품 알림 (${products.size}종)")
            helper.setText(render(products), true)
            mailSender.send(message)
            log.info { "On-sale notification mail sent: from=$from, to=$toEmail, count=${products.size}" }
        } catch (e: Exception) {
            log.error(e) { "Failed to send on-sale notification mail: to=$toEmail" }
        }
    }

    private fun render(products: List<OnSaleProductDto>): String {
        val context =
            Context(Locale.KOREA).apply {
                setVariable("products", products.map { it.toMailItem() })
                setVariable("baseUrl", appProperties.baseUrl.trimEnd('/'))
            }
        return templateEngine.process("mail/on-sale-notification", context)
    }

    private fun OnSaleProductDto.toMailItem() =
        OnSaleMailItem(
            source = source,
            grade = grade,
            gradeColor = GRADE_COLORS[grade] ?: DEFAULT_GRADE_COLOR,
            name = name,
            priceLabel = formatPrice(currency, price),
            url = url,
            imageUrl = imageUrl,
        )

    private fun formatPrice(
        currency: String,
        price: BigDecimal?,
    ): String {
        if (price == null) return "-"
        return when (currency) {
            OnSaleProductDto.CURRENCY_KRW ->
                "₩ " + NumberFormat.getIntegerInstance(Locale.KOREA).format(price.setScale(0, RoundingMode.HALF_UP))
            OnSaleProductDto.CURRENCY_USD -> "$ " + price.setScale(2, RoundingMode.HALF_UP).toPlainString()
            else -> "$price $currency"
        }
    }

    // 메일 템플릿에서 참조하는 표시용 값 — 등급 배지 색은 사용자 페이지(common.js GRADE_COLORS)와 맞춘다
    data class OnSaleMailItem(
        val source: String,
        val grade: String,
        val gradeColor: String,
        val name: String,
        val priceLabel: String,
        val url: String,
        val imageUrl: String?,
    )

    companion object {
        private const val DEFAULT_GRADE_COLOR = "#6c7a8d"
        private val GRADE_COLORS =
            mapOf(
                "HG" to "#2563EB",
                "RG" to "#4B5563",
                "MG" to "#059669",
                "MGSD" to "#7C3AED",
                "MGEX" to "#D4AF37",
                "PG" to "#991B1B",
            )
    }
}
