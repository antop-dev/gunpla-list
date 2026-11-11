package ai.antop.gunpla.user.service

import ai.antop.gunpla.common.exception.NotFoundException
import ai.antop.gunpla.user.dto.AdminUserResponseDto
import ai.antop.gunpla.user.entity.UserAccount
import ai.antop.gunpla.user.entity.UserProduct
import ai.antop.gunpla.user.repository.UserAccountRepository
import ai.antop.gunpla.user.repository.UserProductRepository
import jakarta.persistence.criteria.Predicate
import org.slf4j.LoggerFactory
import org.springframework.data.domain.Sort
import org.springframework.data.jpa.domain.Specification
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime
import java.time.ZoneOffset

// 어드민 사용자 관리 — 목록 조회 및 차단/차단 해제
@Service
class AdminUserService(
    private val userAccountRepository: UserAccountRepository,
    private val userProductRepository: UserProductRepository,
) {
    private val log = LoggerFactory.getLogger(this::class.java)

    // 어드민 사용자 관리 목록 — 검색 조건과 정렬을 서버에서 처리한다
    @Transactional(readOnly = true)
    fun search(
        name: String?,
        email: String?,
        notifyOnSale: Boolean?,
        shareEnabled: Boolean?,
        blocked: Boolean?,
        sortBy: String?,
        sortDir: String?,
    ): List<AdminUserResponseDto> {
        val direction = if (sortDir.equals("asc", ignoreCase = true)) Sort.Direction.ASC else Sort.Direction.DESC
        val spec =
            Specification<UserAccount> { root, query, cb ->
                val predicates = mutableListOf<Predicate>()
                name?.trim()?.lowercase()?.takeIf { it.isNotEmpty() }?.let {
                    predicates += cb.like(cb.lower(root.get("name")), "%$it%")
                }
                email?.trim()?.lowercase()?.takeIf { it.isNotEmpty() }?.let {
                    predicates += cb.like(cb.lower(root.get("email")), "%$it%")
                }
                notifyOnSale?.let { predicates += cb.equal(root.get<Boolean>("notifyOnSale"), it) }
                shareEnabled?.let { predicates += cb.equal(root.get<Boolean>("shareEnabled"), it) }
                blocked?.let { predicates += cb.equal(root.get<Boolean>("blocked"), it) }
                // 보유 제품 수는 엔티티 속성이 아니라서 Sort 대신 서브쿼리로 직접 정렬한다
                if (sortBy == "ownedCount") {
                    val sub = query.subquery(Long::class.java)
                    val userProduct = sub.from(UserProduct::class.java)
                    sub
                        .select(cb.count(userProduct))
                        .where(cb.equal(userProduct.get<Long>("userId"), root.get<Long>("id")), cb.isTrue(userProduct.get("owned")))
                    val order = if (direction == Sort.Direction.ASC) cb.asc(sub) else cb.desc(sub)
                    query.orderBy(order, cb.desc(root.get<Long>("id")))
                }
                cb.and(*predicates.toTypedArray())
            }
        val property =
            when (sortBy) {
                "name", "email", "createdAt", "blocked" -> sortBy
                "ownedCount" -> null
                else -> "lastLoginAt" // 기본
            }
        val sort = property?.let { Sort.by(Sort.Order(direction, it), Sort.Order(Sort.Direction.DESC, "id")) } ?: Sort.unsorted()
        val users = userAccountRepository.findAll(spec, sort)
        val ownedCounts = userProductRepository.countOwnedGroupByUserId().associate { it.userId to it.count }
        return users.map { it.toDto(ownedCounts[it.id] ?: 0) }
    }

    // 차단 즉시 로그인이 막히고, 이미 로그인된 세션은 다음 요청에서 로그아웃된다 (BlockedUserFilter 참고)
    @Transactional
    fun block(id: Long): AdminUserResponseDto {
        val user = findUser(id)
        if (!user.blocked) {
            user.blocked = true
            user.blockedAt = LocalDateTime.now(ZoneOffset.UTC)
            log.info("User blocked. id={}", id)
        }
        return toDto(user)
    }

    @Transactional
    fun unblock(id: Long): AdminUserResponseDto {
        val user = findUser(id)
        if (user.blocked) {
            user.blocked = false
            user.blockedAt = null
            log.info("User unblocked. id={}", id)
        }
        return toDto(user)
    }

    @Transactional(readOnly = true)
    fun isBlocked(googleId: String): Boolean = userAccountRepository.existsByGoogleIdAndBlockedTrue(googleId)

    private fun findUser(id: Long): UserAccount = userAccountRepository.findById(id).orElseThrow { NotFoundException("User not found") }

    private fun toDto(user: UserAccount): AdminUserResponseDto {
        val ownedCount = userProductRepository.countByUserIdAndOwnedTrue(requireNotNull(user.id))
        return user.toDto(ownedCount)
    }

    private fun UserAccount.toDto(ownedCount: Long) =
        AdminUserResponseDto(
            id = requireNotNull(id),
            email = email,
            name = name,
            picture = picture,
            ownedCount = ownedCount,
            notifyOnSale = notifyOnSale,
            shareEnabled = shareEnabled,
            blocked = blocked,
            blockedAt = blockedAt,
            lastLoginAt = lastLoginAt,
            createdAt = createdAt,
        )
}
