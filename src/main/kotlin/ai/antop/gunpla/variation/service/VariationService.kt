package ai.antop.gunpla.variation.service

import ai.antop.gunpla.common.exception.BadRequestException
import ai.antop.gunpla.common.exception.NotFoundException
import ai.antop.gunpla.product.service.ProductService
import ai.antop.gunpla.variation.dto.VariationAssignmentDto
import ai.antop.gunpla.variation.dto.VariationCreateRequestDto
import ai.antop.gunpla.variation.dto.VariationLinkDto
import ai.antop.gunpla.variation.dto.VariationNodeDto
import ai.antop.gunpla.variation.dto.VariationResponseDto
import ai.antop.gunpla.variation.dto.VariationSaveRequestDto
import ai.antop.gunpla.variation.dto.VariationSummaryDto
import ai.antop.gunpla.variation.entity.Variation
import ai.antop.gunpla.variation.entity.VariationLink
import ai.antop.gunpla.variation.entity.VariationNode
import ai.antop.gunpla.variation.repository.VariationLinkRepository
import ai.antop.gunpla.variation.repository.VariationNodeRepository
import ai.antop.gunpla.variation.repository.VariationRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime
import java.time.ZoneOffset

private val log = KotlinLogging.logger {}

// 제품 바리에이션 구성도(가계도) — 보드 단위로 제품 카드와 원본 → 바리에이션 연결선을 관리한다
@Service
class VariationService(
    private val variationRepository: VariationRepository,
    private val variationNodeRepository: VariationNodeRepository,
    private val variationLinkRepository: VariationLinkRepository,
    private val productService: ProductService,
) {
    @Transactional(readOnly = true)
    fun findAll(): List<VariationSummaryDto> {
        val countMap = variationNodeRepository.findAll().groupingBy { it.variationId }.eachCount()
        return variationRepository.findAllByOrderByNameAsc().map {
            VariationSummaryDto(
                id = it.id,
                name = it.name,
                productCount = countMap[it.id] ?: 0,
                updatedAt = it.updatedAt,
            )
        }
    }

    @Transactional(readOnly = true)
    fun get(id: String): VariationResponseDto {
        val variation = variationRepository.findById(id).orElseThrow { NotFoundException("Variation not found: $id") }
        return variation.toDto()
    }

    // 사용자 그리드의 구성도 아이콘 — 제품이 올라간 보드를 찾는다
    @Transactional(readOnly = true)
    fun getByProductId(productId: Long): VariationResponseDto {
        val node =
            variationNodeRepository.findByProductId(productId)
                ?: throw NotFoundException("Variation not found for product: $productId")
        return get(node.variationId)
    }

    @Transactional(readOnly = true)
    fun findAssignments(): List<VariationAssignmentDto> =
        variationNodeRepository.findAll().map { VariationAssignmentDto(productId = it.productId, variationId = it.variationId) }

    @Transactional
    fun create(request: VariationCreateRequestDto): VariationResponseDto {
        val name = request.name.trim()
        if (name.isEmpty()) throw BadRequestException("보드 이름을 입력해주세요.")
        return variationRepository.save(Variation(name = name)).toDto()
    }

    // 카드/연결선을 통째로 교체한다 — 편집 화면이 보드 전체 상태를 들고 있으므로 차이 계산보다 단순하고 안전하다
    @Transactional
    fun save(
        id: String,
        request: VariationSaveRequestDto,
    ): VariationResponseDto {
        val variation = variationRepository.findById(id).orElseThrow { NotFoundException("Variation not found: $id") }
        val name = request.name.trim()
        if (name.isEmpty()) throw BadRequestException("보드 이름을 입력해주세요.")
        validate(id, request)

        variation.name = name
        // 카드 좌표만 바뀐 저장에도 수정일이 갱신되도록 직접 설정한다 (@PreUpdate 는 엔티티 컬럼 변경이 있어야 동작)
        variation.updatedAt = LocalDateTime.now(ZoneOffset.UTC)
        variationLinkRepository.deleteAllByVariationId(id)
        variationNodeRepository.deleteAllByVariationId(id)
        variationNodeRepository.saveAll(
            request.nodes.map { VariationNode(variationId = id, productId = it.productId, posX = it.x, posY = it.y) },
        )
        variationLinkRepository.saveAll(
            request.links.map {
                VariationLink(
                    variationId = id,
                    parentProductId = it.parentProductId,
                    childProductId = it.childProductId,
                    direction = it.direction,
                )
            },
        )
        log.info { "variation saved: id=$id, nodes=${request.nodes.size}, links=${request.links.size}" }
        // deleteAllByVariationId 가 영속성 컨텍스트를 비우므로 보드를 다시 읽어 응답한다
        return get(id)
    }

    @Transactional
    fun delete(id: String) {
        if (!variationRepository.existsById(id)) throw NotFoundException("Variation not found: $id")
        variationLinkRepository.deleteAllByVariationId(id)
        variationNodeRepository.deleteAllByVariationId(id)
        variationRepository.deleteById(id)
    }

    private fun validate(
        variationId: String,
        request: VariationSaveRequestDto,
    ) {
        val productIds = request.nodes.map { it.productId }
        if (productIds.size != productIds.toSet().size) throw BadRequestException("같은 제품을 보드에 두 번 올릴 수 없습니다.")

        val existing = productService.findAllByIds(productIds).associateBy { it.id }
        productIds.firstOrNull { it !in existing }?.let { throw BadRequestException("존재하지 않는 제품입니다: $it") }
        // 제품 하나는 보드 하나에만 — 사용자 화면에서 제품으로 구성도를 바로 찾기 위한 제약
        existing.values
            .firstOrNull { it.variationId != null && it.variationId != variationId }
            ?.let { throw BadRequestException("다른 보드에 이미 올라간 제품입니다: ${it.name}") }

        val idSet = productIds.toSet()
        request.links.forEach {
            if (it.parentProductId == it.childProductId) throw BadRequestException("제품을 자기 자신과 연결할 수 없습니다.")
            if (it.parentProductId !in idSet || it.childProductId !in idSet) throw BadRequestException("보드에 없는 제품이 연결되어 있습니다.")
        }
        // 방향만 다른 같은 두 제품의 연결도 중복으로 본다 (parent_product_id + child_product_id UNIQUE)
        val pairs = request.links.map { it.parentProductId to it.childProductId }
        if (pairs.size != pairs.toSet().size) throw BadRequestException("같은 연결선이 중복되어 있습니다.")
        if (hasCycle(request.links)) throw BadRequestException("연결선이 순환합니다. 원본 → 바리에이션 방향을 확인해주세요.")
    }

    // 바리에이션 관계는 원본 → 바리에이션 한 방향이어야 하므로 순환을 막는다 (DFS 방문 상태: 1=방문 중, 2=완료)
    private fun hasCycle(links: List<VariationLinkDto>): Boolean {
        val children = links.groupBy({ it.parentProductId }, { it.childProductId })
        val state = mutableMapOf<Long, Int>()

        fun visit(id: Long): Boolean {
            when (state[id]) {
                1 -> return true
                2 -> return false
            }
            state[id] = 1
            if (children[id].orEmpty().any { visit(it) }) return true
            state[id] = 2
            return false
        }
        return children.keys.any { visit(it) }
    }

    // 논리 삭제된 제품은 카드와 연결선 모두 빼고 보여준다
    private fun Variation.toDto(): VariationResponseDto {
        val variationId = id
        val nodes = variationNodeRepository.findAllByVariationId(variationId)
        val productMap = productService.findAllByIds(nodes.map { it.productId }).associateBy { it.id }
        val links = variationLinkRepository.findAllByVariationId(variationId)
        return VariationResponseDto(
            id = variationId,
            name = name,
            nodes =
                nodes.mapNotNull { node ->
                    productMap[node.productId]?.let { VariationNodeDto(product = it, x = node.posX, y = node.posY) }
                },
            links =
                links
                    .filter { it.parentProductId in productMap && it.childProductId in productMap }
                    .map {
                        VariationLinkDto(
                            parentProductId = it.parentProductId,
                            childProductId = it.childProductId,
                            direction = it.direction,
                        )
                    },
        )
    }
}
