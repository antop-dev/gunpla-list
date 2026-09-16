package ai.antop.gunpla.productrequest.service

import ai.antop.gunpla.category.dto.CategoryResponseDto
import ai.antop.gunpla.category.entity.Category
import ai.antop.gunpla.category.repository.CategoryRepository
import ai.antop.gunpla.common.config.AppProperties
import ai.antop.gunpla.common.exception.BadRequestException
import ai.antop.gunpla.common.exception.NotFoundException
import ai.antop.gunpla.common.exception.UnauthorizedException
import ai.antop.gunpla.common.util.ImageUtils
import ai.antop.gunpla.product.dto.ProductCreateRequestDto
import ai.antop.gunpla.product.dto.ProductUpdateRequestDto
import ai.antop.gunpla.product.entity.Product
import ai.antop.gunpla.product.repository.ProductRepository
import ai.antop.gunpla.product.service.ProductService
import ai.antop.gunpla.productrequest.dto.ProductRequestApproveRequestDto
import ai.antop.gunpla.productrequest.dto.ProductRequestCreateRequestDto
import ai.antop.gunpla.productrequest.dto.ProductRequestFieldsDto
import ai.antop.gunpla.productrequest.dto.ProductRequestResponseDto
import ai.antop.gunpla.productrequest.entity.ProductRequest
import ai.antop.gunpla.productrequest.entity.ProductRequestStatus
import ai.antop.gunpla.productrequest.entity.ProductRequestType
import ai.antop.gunpla.productrequest.repository.ProductRequestRepository
import ai.antop.gunpla.user.entity.UserAccount
import ai.antop.gunpla.user.repository.UserAccountRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.multipart.MultipartFile
import java.nio.file.Files
import java.nio.file.Path
import java.time.LocalDateTime
import java.time.ZoneOffset
import java.util.UUID

private val log = KotlinLogging.logger {}

// 사용자 제품 등록/수정 요청의 접수 ~ 관리자 승인/반려 처리
// 승인 시 실제 제품 반영은 ProductService 에 위임한다 (제품 저장 규칙을 한 곳에만 두기 위함)
@Service
class ProductRequestService(
    private val productRequestRepository: ProductRequestRepository,
    private val productRepository: ProductRepository,
    private val categoryRepository: CategoryRepository,
    private val userAccountRepository: UserAccountRepository,
    private val productService: ProductService,
    private val appProperties: AppProperties,
    @Value("\${server.servlet.context-path:}") private val contextPath: String,
) {
    // ---- 사용자 ----

    @Transactional(readOnly = true)
    fun findMine(googleId: String): List<ProductRequestResponseDto> {
        val user = findUser(googleId)
        return productRequestRepository.findByUserIdOrderByCreatedAtDesc(user.id!!).toDtos()
    }

    @Transactional
    fun create(
        googleId: String,
        request: ProductRequestCreateRequestDto,
    ): ProductRequestResponseDto {
        val user = findUser(googleId)
        if (request.name.isBlank()) throw BadRequestException("제품명은 필수입니다.")
        if (request.grade.isBlank()) throw BadRequestException("등급은 필수입니다.")
        // 수정 요청은 대상 제품이 실제로 존재해야 한다
        if (request.type == ProductRequestType.MODIFY) {
            val productId = request.productId ?: throw BadRequestException("수정할 제품이 지정되지 않았습니다.")
            findProduct(productId)
        }
        val saved =
            productRequestRepository.save(
                ProductRequest(
                    type = request.type,
                    userId = user.id!!,
                    productId = request.productId?.takeIf { request.type == ProductRequestType.MODIFY },
                    grade = request.grade,
                    modelNumber = request.modelNumber?.takeIf { it.isNotBlank() },
                    name = request.name,
                    releaseYear = request.releaseYear,
                    releaseMonth = request.releaseMonth,
                    currency = request.currency?.takeIf { it.isNotBlank() },
                    price = request.price,
                    manualUrls = request.manualUrls,
                    sourceUrl = request.sourceUrl?.takeIf { it.isNotBlank() },
                    series = request.series?.takeIf { it.isNotBlank() },
                    categoryId = request.categoryId,
                ),
            )
        log.info { "Product request created. requestId=${saved.id}, type=${saved.type}, userId=${user.id}" }
        return saved.toDto(user)
    }

    // 박스아트는 요청을 만든 뒤 별도 업로드한다 (제품 등록과 같은 2단계 흐름)
    @Transactional
    fun uploadBoxArt(
        googleId: String,
        id: Long,
        file: MultipartFile,
    ): ProductRequestResponseDto {
        val user = findUser(googleId)
        val request = findOwnRequest(id, user)
        if (request.status != ProductRequestStatus.PENDING) throw BadRequestException("대기 중인 요청만 수정할 수 있습니다.")

        val ext = file.originalFilename?.substringAfterLast('.', "jpg")?.lowercase() ?: "jpg"
        val uuid = UUID.randomUUID().toString()
        val origPath = originalDir().resolve("$uuid.original.$ext")
        val thumbPath = thumbnailDir().resolve("$uuid.thumbnail.jpg")
        file.transferTo(origPath)
        ImageUtils.createThumbnail(origPath, thumbPath)
        log.debug { "uploadBoxArt: requestId=$id, origPath=$origPath, thumbPath=$thumbPath" }

        deleteBoxArtFiles(request)
        request.boxArtPath = origPath.toString()
        request.boxArtThumbPath = thumbPath.toString()
        return request.toDto(user)
    }

    // 대기 상태의 요청만 사용자가 직접 철회할 수 있다
    // 레코드를 지우지 않고 CANCELED 로 남겨 요청자가 이력을 계속 볼 수 있게 한다 (첨부한 박스아트도 그대로 보관)
    @Transactional
    fun cancel(
        googleId: String,
        id: Long,
    ): ProductRequestResponseDto {
        val user = findUser(googleId)
        val request = findOwnRequest(id, user)
        if (request.status != ProductRequestStatus.PENDING) throw BadRequestException("이미 처리된 요청은 취소할 수 없습니다.")
        request.status = ProductRequestStatus.CANCELED
        request.processedAt = LocalDateTime.now(ZoneOffset.UTC)
        log.info { "Product request canceled. requestId=$id, userId=${user.id}" }
        return request.toDto(user)
    }

    // ---- 관리자 ----

    @Transactional(readOnly = true)
    fun findAll(status: ProductRequestStatus?): List<ProductRequestResponseDto> {
        val requests =
            if (status == null) {
                productRequestRepository.findAllByOrderByCreatedAtDesc()
            } else {
                productRequestRepository.findByStatusOrderByCreatedAtDesc(status)
            }
        return requests.toDtos()
    }

    @Transactional(readOnly = true)
    fun get(id: Long): ProductRequestResponseDto {
        val request = findRequest(id)
        return request.toDto(userAccountRepository.findById(request.userId).orElse(null))
    }

    @Transactional(readOnly = true)
    fun countPending(): Long = productRequestRepository.countByStatus(ProductRequestStatus.PENDING)

    // 승인 — 관리자가 팝업에서 보정한 값(request 파라미터)이 그대로 제품에 저장된다
    // 요청 레코드 자체는 사용자가 올린 원본 그대로 남겨 이력으로 보존한다
    @Transactional
    fun approve(
        id: Long,
        adminName: String,
        request: ProductRequestApproveRequestDto,
    ): ProductRequestResponseDto {
        val productRequest = findRequest(id)
        if (productRequest.status != ProductRequestStatus.PENDING) throw BadRequestException("대기 중인 요청만 처리할 수 있습니다.")
        if (request.name.isBlank()) throw BadRequestException("제품명은 필수입니다.")

        val productId =
            when (productRequest.type) {
                ProductRequestType.REGISTER ->
                    productService
                        .create(
                            ProductCreateRequestDto(
                                grade = request.grade,
                                modelNumber = request.modelNumber,
                                name = request.name,
                                releaseYear = request.releaseYear,
                                releaseMonth = request.releaseMonth,
                                currency = request.currency,
                                price = request.price,
                                manualUrls = request.manualUrls,
                                sourceUrl = request.sourceUrl,
                                series = request.series,
                                categoryId = request.categoryId,
                            ),
                        ).id

                ProductRequestType.MODIFY -> {
                    val targetId = productRequest.productId ?: throw BadRequestException("수정할 제품이 지정되지 않았습니다.")
                    productService
                        .update(
                            targetId,
                            ProductUpdateRequestDto(
                                grade = request.grade,
                                modelNumber = request.modelNumber,
                                name = request.name,
                                releaseYear = request.releaseYear,
                                releaseMonth = request.releaseMonth,
                                currency = request.currency,
                                price = request.price,
                                manualUrls = request.manualUrls,
                                sourceUrl = request.sourceUrl,
                                series = request.series,
                                categoryId = request.categoryId,
                            ),
                        ).id
                }
            }

        val boxArtPath = productRequest.boxArtPath
        val boxArtThumbPath = productRequest.boxArtThumbPath
        if (request.applyBoxArt && boxArtPath != null && boxArtThumbPath != null) {
            productService.replaceBoxArtFiles(productId, boxArtPath, boxArtThumbPath)
        }

        productRequest.productId = productId
        productRequest.status = ProductRequestStatus.APPROVED
        productRequest.processedBy = adminName
        productRequest.processedAt = LocalDateTime.now(ZoneOffset.UTC)
        log.info { "Product request approved. requestId=$id, productId=$productId, admin=$adminName" }
        return productRequest.toDto(userAccountRepository.findById(productRequest.userId).orElse(null))
    }

    @Transactional
    fun reject(
        id: Long,
        adminName: String,
        reason: String,
    ): ProductRequestResponseDto {
        val productRequest = findRequest(id)
        if (productRequest.status != ProductRequestStatus.PENDING) throw BadRequestException("대기 중인 요청만 처리할 수 있습니다.")
        if (reason.isBlank()) throw BadRequestException("반려 사유는 필수입니다.")
        productRequest.status = ProductRequestStatus.REJECTED
        productRequest.rejectReason = reason
        productRequest.processedBy = adminName
        productRequest.processedAt = LocalDateTime.now(ZoneOffset.UTC)
        log.info { "Product request rejected. requestId=$id, admin=$adminName" }
        return productRequest.toDto(userAccountRepository.findById(productRequest.userId).orElse(null))
    }

    // ---- 조회 헬퍼 ----

    private fun findUser(googleId: String): UserAccount = userAccountRepository.findByGoogleId(googleId) ?: throw UnauthorizedException()

    private fun findRequest(id: Long): ProductRequest =
        productRequestRepository.findById(id).orElseThrow { NotFoundException("Product request not found: $id") }

    private fun findOwnRequest(
        id: Long,
        user: UserAccount,
    ): ProductRequest {
        val request = findRequest(id)
        // 다른 사람의 요청은 존재 여부도 알리지 않는다
        if (request.userId != user.id) throw NotFoundException("Product request not found: $id")
        return request
    }

    private fun findProduct(id: Long): Product =
        productRepository
            .findById(id)
            .filter { !it.deleted }
            .orElseThrow { NotFoundException("Product not found: $id") }

    // 목록 조회는 요청자/카테고리를 건별로 조회하지 않고 일괄 조회해 N+1 을 피한다
    private fun List<ProductRequest>.toDtos(): List<ProductRequestResponseDto> {
        if (isEmpty()) return emptyList()
        val userMap = userAccountRepository.findAllById(map { it.userId }.distinct()).associateBy { it.id!! }
        return map { it.toDto(userMap[it.userId]) }
    }

    // ---- 박스아트 파일 ----

    // normalize() 로 "./" 같은 상대 표기를 정리한다 — 저장 경로와 URL 변환의 접두사 비교가 항상 맞아떨어지도록
    private fun originalDir(): Path {
        val dir = Path.of(appProperties.boxArt.originalDirectory).toAbsolutePath().normalize()
        Files.createDirectories(dir)
        return dir
    }

    private fun thumbnailDir(): Path {
        val dir = Path.of(appProperties.boxArt.thumbnailDirectory).toAbsolutePath().normalize()
        Files.createDirectories(dir)
        return dir
    }

    private fun deleteBoxArtFiles(request: ProductRequest) {
        request.boxArtPath?.let { deleteFile(Path.of(it)) }
        request.boxArtThumbPath?.let { deleteFile(Path.of(it)) }
    }

    private fun deleteFile(path: Path) {
        try {
            Files.deleteIfExists(path)
        } catch (e: Exception) {
            log.warn(e) { "deleteFile: failed to delete $path" }
        }
    }

    // 파일시스템 절대경로를 클라이언트가 접근 가능한 HTTP URL 로 변환 (ProductService 와 동일 규칙)
    private fun String.toBoxArtServingUrl(): String {
        val origAbs = originalDir().toString()
        val thumbAbs = thumbnailDir().toString()
        val fileName = Path.of(this).fileName.toString()
        val normalized =
            Path
                .of(this)
                .toAbsolutePath()
                .normalize()
                .toString()
        val prefix = contextPath.trimEnd('/')
        return when {
            normalized.startsWith(origAbs) -> "$prefix/box-art/original/$fileName"
            normalized.startsWith(thumbAbs) -> "$prefix/box-art/thumbnail/$fileName"
            else -> this
        }
    }

    // ---- DTO 변환 ----

    private fun Category.toDto() = CategoryResponseDto(id = id!!, name = name, color = color, sortOrder = sortOrder)

    private fun categoryDto(categoryId: Long?): CategoryResponseDto? =
        categoryId?.let { categoryRepository.findById(it).orElse(null)?.toDto() }

    private fun ProductRequest.toRequestedFields() =
        ProductRequestFieldsDto(
            grade = grade,
            modelNumber = modelNumber,
            name = name,
            releaseYear = releaseYear,
            releaseMonth = releaseMonth,
            currency = currency,
            price = price,
            manualUrls = manualUrls,
            sourceUrl = sourceUrl,
            series = series,
            category = categoryDto(categoryId),
            boxArtUrl = boxArtPath?.toBoxArtServingUrl(),
            boxArtThumbUrl = boxArtThumbPath?.toBoxArtServingUrl(),
        )

    private fun Product.toCurrentFields() =
        ProductRequestFieldsDto(
            grade = grade,
            modelNumber = modelNumber,
            name = name,
            releaseYear = releaseYear,
            releaseMonth = releaseMonth,
            currency = currency,
            price = price,
            manualUrls = manualUrls,
            sourceUrl = sourceUrl,
            series = series,
            category = categoryDto(categoryId),
            boxArtUrl = boxArtPath?.toBoxArtServingUrl(),
            boxArtThumbUrl = boxArtThumbPath?.toBoxArtServingUrl(),
        )

    // 수정 요청이면 대상 제품의 현재 값을 함께 내려 화면에서 FROM -> TO 로 비교한다
    // 승인/반려가 끝난 뒤에는 제품이 이미 바뀌었으므로 비교 대상이 되지 않지만, 이력 확인을 위해 그대로 내려준다
    private fun ProductRequest.toDto(user: UserAccount?) =
        ProductRequestResponseDto(
            id = id!!,
            type = type,
            status = status,
            productId = productId,
            current = productId?.let { productRepository.findById(it).orElse(null) }?.toCurrentFields(),
            requested = toRequestedFields(),
            rejectReason = rejectReason,
            requesterName = user?.name,
            requesterPicture = user?.picture,
            processedBy = processedBy,
            processedAt = processedAt,
            createdAt = createdAt,
        )
}
