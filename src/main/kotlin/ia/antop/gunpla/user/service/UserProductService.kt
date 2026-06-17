package ia.antop.gunpla.user.service

import ia.antop.gunpla.common.exception.NotFoundException
import ia.antop.gunpla.product.service.ProductService
import ia.antop.gunpla.user.dto.UserProductResponseDto
import ia.antop.gunpla.user.dto.UserProductUpdateRequestDto
import ia.antop.gunpla.user.entity.UserProduct
import ia.antop.gunpla.user.repository.UserAccountRepository
import ia.antop.gunpla.user.repository.UserProductRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class UserProductService(
    private val userAccountRepository: UserAccountRepository,
    private val userProductRepository: UserProductRepository,
    private val productService: ProductService,
) {
    @Transactional(readOnly = true)
    fun search(
        googleId: String,
        name: String?,
        grade: String?,
        modelNumber: String?,
        categoryId: Long?,
        owned: Boolean?,
        purchasePlace: String?,
        decal: String?,
        keyword: String? = null,
    ): List<UserProductResponseDto> {
        val user =
            userAccountRepository.findByGoogleId(googleId)
                ?: throw NotFoundException("User not found")

        // keyword 검색은 product 필드(name, modelNumber)와 user_product 필드(purchasePlace, decal)를
        // 모두 포함해야 하므로 cross-entity JOIN SQL 대신 인메모리 필터를 사용
        // grade/categoryId 는 DB 에서 먼저 걸러 결과 셋을 줄인 후 나머지를 메모리에서 처리
        val products =
            if (!keyword.isNullOrBlank()) {
                productService.search(null, grade, null, categoryId)
            } else {
                productService.search(name, grade, modelNumber, categoryId)
            }
        val userProductMap =
            userProductRepository
                .findAllByUserId(user.id!!)
                .associateBy { it.productId }

        return products.mapNotNull { product ->
            val up = userProductMap[product.id]
            val ownedVal = up?.owned ?: false
            val purchasePlaceVal = up?.purchasePlace
            val decalVal = up?.decal

            // keyword 가 있을 때 product 이름/모델번호 또는 구매처/데칼 중 하나라도 포함하면 포함
            if (!keyword.isNullOrBlank()) {
                val kw = keyword.lowercase()
                val matchesProduct =
                    product.name.lowercase().contains(kw) ||
                        product.modelNumber
                            .orEmpty()
                            .lowercase()
                            .contains(kw)
                val matchesUser =
                    purchasePlaceVal.orEmpty().lowercase().contains(kw) ||
                        decalVal.orEmpty().lowercase().contains(kw)
                if (!matchesProduct && !matchesUser) return@mapNotNull null
            }

            if (owned != null && ownedVal != owned) return@mapNotNull null
            if (!purchasePlace.isNullOrBlank() &&
                !purchasePlaceVal.orEmpty().contains(purchasePlace, ignoreCase = true)
            ) {
                return@mapNotNull null
            }
            if (!decal.isNullOrBlank() && !decalVal.orEmpty().contains(decal, ignoreCase = true)) return@mapNotNull null

            UserProductResponseDto(
                product = product,
                owned = ownedVal,
                purchaseDate = up?.purchaseDate,
                purchasePlace = purchasePlaceVal,
                purchaseCurrency = up?.purchaseCurrency,
                purchasePrice = up?.purchasePrice,
                decal = decalVal,
            )
        }
    }

    @Transactional
    fun update(
        googleId: String,
        productId: Long,
        request: UserProductUpdateRequestDto,
    ): UserProductResponseDto {
        val user =
            userAccountRepository.findByGoogleId(googleId)
                ?: throw NotFoundException("User not found")

        // user_product 행이 없으면 새로 생성 (upsert 패턴)
        val up =
            userProductRepository.findByUserIdAndProductId(user.id!!, productId)
                ?: UserProduct(userId = user.id!!, productId = productId)

        up.owned = request.owned
        up.purchaseDate = request.purchaseDate
        up.purchasePlace = request.purchasePlace?.takeIf { it.isNotBlank() }
        up.purchaseCurrency = request.purchaseCurrency?.takeIf { it.isNotBlank() }
        up.purchasePrice = request.purchasePrice
        up.decal = request.decal?.takeIf { it.isNotBlank() }

        userProductRepository.save(up)

        // 저장 후 최신 product 정보를 다시 조회 (박스아트 URL 등 서비스 계층 변환값 포함)
        val product =
            productService
                .search(null, null, null, null)
                .firstOrNull { it.id == productId }
                ?: throw NotFoundException("Product not found: $productId")

        return UserProductResponseDto(
            product = product,
            owned = up.owned,
            purchaseDate = up.purchaseDate,
            purchasePlace = up.purchasePlace,
            purchaseCurrency = up.purchaseCurrency,
            purchasePrice = up.purchasePrice,
            decal = up.decal,
        )
    }
}
