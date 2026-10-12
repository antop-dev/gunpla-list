package ai.antop.gunpla.onsale.service

import ai.antop.gunpla.common.exception.NotFoundException
import ai.antop.gunpla.onsale.dto.OnSaleAlertResponseDto
import ai.antop.gunpla.onsale.dto.OnSaleAlertUpdateRequestDto
import ai.antop.gunpla.onsale.entity.OnSaleAlertOff
import ai.antop.gunpla.onsale.repository.OnSaleAlertOffRepository
import ai.antop.gunpla.onsale.repository.OnSaleProductRepository
import ai.antop.gunpla.user.repository.UserAccountRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

// 판매제품 모아보기 제품별 알림 조회/일괄 변경 — 기본 켬이고, 사용자가 끈 제품만 on_sale_alert_off 에 저장한다
@Service
class OnSaleAlertService(
    private val userAccountRepository: UserAccountRepository,
    private val onSaleAlertOffRepository: OnSaleAlertOffRepository,
    private val onSaleProductRepository: OnSaleProductRepository,
) {
    @Transactional(readOnly = true)
    fun get(googleId: String): OnSaleAlertResponseDto = OnSaleAlertResponseDto(currentOffHashes(userId(googleId)))

    @Transactional
    fun update(
        googleId: String,
        request: OnSaleAlertUpdateRequestDto,
    ): OnSaleAlertResponseDto {
        val userId = userId(googleId)
        val existing = onSaleAlertOffRepository.findAllByUserId(userId).associateBy { it.productHash }
        val requested = request.hashes.toSet()
        if (request.enabled) {
            onSaleAlertOffRepository.deleteAll(requested.mapNotNull { existing[it] })
        } else {
            // 목록에 없는 해시(조작된 요청 등)는 무시하고, 이미 끈 제품은 그대로 둔다
            val valid = onSaleProductRepository.findAllById(requested - existing.keys).map { it.hash }
            onSaleAlertOffRepository.saveAll(valid.map { OnSaleAlertOff(userId = userId, productHash = it) })
        }
        return OnSaleAlertResponseDto(currentOffHashes(userId))
    }

    private fun currentOffHashes(userId: Long): List<String> = onSaleAlertOffRepository.findAllByUserId(userId).map { it.productHash }

    private fun userId(googleId: String): Long =
        userAccountRepository.findByGoogleId(googleId)?.id ?: throw NotFoundException("User not found")
}
