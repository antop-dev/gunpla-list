package ai.antop.gunpla.dashboard.service

import ai.antop.gunpla.common.exception.NotFoundException
import ai.antop.gunpla.dashboard.dto.DashboardCategoryCountDto
import ai.antop.gunpla.dashboard.dto.DashboardGradeCountDto
import ai.antop.gunpla.dashboard.dto.DashboardSummaryResponseDto
import ai.antop.gunpla.dashboard.dto.DashboardTopProductDto
import ai.antop.gunpla.dashboard.dto.DashboardUserProductResponseDto
import ai.antop.gunpla.dashboard.dto.DashboardUserResponseDto
import ai.antop.gunpla.product.dto.ProductResponseDto
import ai.antop.gunpla.product.service.ProductService
import ai.antop.gunpla.user.entity.UserProduct
import ai.antop.gunpla.user.repository.UserAccountRepository
import ai.antop.gunpla.user.repository.UserProductRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

// 어드민 대시보드 집계
// 사용자/보유 데이터 규모가 작아(수십 명, 수천 건) UserProductService 와 같이 전체 조회 후 인메모리로 집계한다
// 소프트 딜리트된 제품은 productService.search() 결과에 없으므로 보유 집계에서 자연스럽게 제외된다
@Service
class DashboardService(
    private val userAccountRepository: UserAccountRepository,
    private val userProductRepository: UserProductRepository,
    private val productService: ProductService,
) {
    @Transactional(readOnly = true)
    fun summary(): DashboardSummaryResponseDto {
        val users = userAccountRepository.findAll()
        val productMap = productService.search().associateBy { it.id }
        val owned = findOwned(productMap)
        val activeUsers = owned.map { it.userId }.distinct().size

        val gradeDistribution =
            owned
                .groupingBy { productMap.getValue(it.productId).grade }
                .eachCount()
                .map { (grade, count) -> DashboardGradeCountDto(grade, count) }
                .sortedByDescending { it.count }

        val categoryDistribution =
            owned
                .groupingBy { productMap.getValue(it.productId).category?.name }
                .eachCount()
                .map { (name, count) -> DashboardCategoryCountDto(name, count) }
                .sortedByDescending { it.count }

        val topProducts =
            owned
                .groupBy { it.productId }
                .map { (productId, rows) ->
                    DashboardTopProductDto(
                        product = productMap.getValue(productId),
                        ownerCount = rows.size,
                        assembledCount = rows.count { it.assembled },
                    )
                }.sortedWith(compareByDescending<DashboardTopProductDto> { it.ownerCount }.thenBy { it.product.name })
                .take(TOP_PRODUCT_LIMIT)

        return DashboardSummaryResponseDto(
            totalUsers = users.size,
            activeUsers = activeUsers,
            totalOwned = owned.size,
            avgOwnedPerActiveUser = if (activeUsers == 0) 0.0 else owned.size.toDouble() / activeUsers,
            notifySubscribers = users.count { it.notifyOnSale },
            gradeDistribution = gradeDistribution,
            categoryDistribution = categoryDistribution,
            topProducts = topProducts,
        )
    }

    @Transactional(readOnly = true)
    fun users(): List<DashboardUserResponseDto> {
        val productMap = productService.search().associateBy { it.id }
        val ownedByUser = findOwned(productMap).groupBy { it.userId }
        val lastActivityByUser =
            userProductRepository
                .findAll()
                .groupBy { it.userId }
                .mapValues { (_, rows) -> rows.maxOf { it.updatedAt } }

        return userAccountRepository
            .findAll()
            .map { user ->
                val owned = ownedByUser[user.id].orEmpty()
                DashboardUserResponseDto(
                    id = user.id!!,
                    name = user.name?.let { maskName(it) },
                    email = user.email?.let { maskEmail(it) },
                    picture = user.picture,
                    ownedCount = owned.size,
                    assembledCount = owned.count { it.assembled },
                    notifyOnSale = user.notifyOnSale,
                    createdAt = user.createdAt,
                    lastActivityAt = lastActivityByUser[user.id],
                )
            }.sortedByDescending { it.ownedCount }
    }

    @Transactional(readOnly = true)
    fun userProducts(userId: Long): List<DashboardUserProductResponseDto> {
        if (!userAccountRepository.existsById(userId)) throw NotFoundException("User not found")
        val productMap = productService.search().associateBy { it.id }

        return userProductRepository
            .findAllByUserId(userId)
            .filter { it.owned }
            .mapNotNull { up ->
                val product = productMap[up.productId] ?: return@mapNotNull null
                DashboardUserProductResponseDto(
                    product = product,
                    assembled = up.assembled,
                    decalAttached = up.decalAttached,
                    purchaseDate = up.purchaseDate,
                    purchasePlace = up.purchasePlace,
                    purchaseCurrency = up.purchaseCurrency,
                    purchasePrice = up.purchasePrice,
                    createdAt = up.createdAt,
                )
            }
    }

    // 실명 노출 방지 — 공백으로 나뉜 단어마다 첫/마지막 글자만 남기고 가운데를 * 로 가린다
    // 홍길동 → 홍*동, 남궁민수 → 남**수, 홍길 → 홍*, John Smith → J**n S***h
    private fun maskName(name: String): String =
        name.trim().split(Regex("\\s+")).joinToString(" ") { word ->
            when (word.length) {
                1 -> word
                2 -> word.first() + "*"
                else -> word.first() + "*".repeat(word.length - 2) + word.last()
            }
        }

    // 이메일은 아이디(@ 앞) 부분만 앞 2글자를 남기고 가린다 — 도메인은 그대로 노출
    // gundam@gmail.com → gu****@gmail.com, ab@gmail.com → a*@gmail.com
    private fun maskEmail(email: String): String {
        val at = email.indexOf('@')
        if (at <= 0) return email
        val id = email.substring(0, at)
        val visible = if (id.length <= 2) 1 else 2
        return id.take(visible) + "*".repeat(id.length - visible) + email.substring(at)
    }

    private fun findOwned(productMap: Map<Long, ProductResponseDto>): List<UserProduct> =
        userProductRepository.findAll().filter { it.owned && productMap.containsKey(it.productId) }

    companion object {
        private const val TOP_PRODUCT_LIMIT = 10
    }
}
