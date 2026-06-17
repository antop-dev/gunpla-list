package ia.antop.gunpla.product.service

import ia.antop.gunpla.category.dto.CategoryResponseDto
import ia.antop.gunpla.category.entity.Category
import ia.antop.gunpla.category.repository.CategoryRepository
import ia.antop.gunpla.common.config.AppProperties
import ia.antop.gunpla.common.exception.BadRequestException
import ia.antop.gunpla.common.exception.NotFoundException
import ia.antop.gunpla.common.util.ImageUtils
import ia.antop.gunpla.product.dto.ProductCreateRequestDto
import ia.antop.gunpla.product.dto.ProductResponseDto
import ia.antop.gunpla.product.dto.ProductUpdateRequestDto
import ia.antop.gunpla.product.entity.Product
import ia.antop.gunpla.product.repository.ProductRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.multipart.MultipartFile
import java.net.URI
import java.nio.file.Files
import java.nio.file.Path
import java.util.UUID

private val log = KotlinLogging.logger {}

@Service
class ProductService(
    private val productRepository: ProductRepository,
    private val categoryRepository: CategoryRepository,
    private val appProperties: AppProperties,
    @Value("\${server.servlet.context-path:}") private val contextPath: String,
) {
    @Transactional(readOnly = true)
    fun search(
        name: String?,
        grade: String?,
        modelNumber: String?,
        categoryId: Long?,
        keyword: String? = null,
    ): List<ProductResponseDto> {
        val products =
            productRepository.search(
                keyword = keyword?.takeIf { it.isNotBlank() },
                name = name?.takeIf { it.isNotBlank() },
                grade = grade?.takeIf { it.isNotBlank() },
                modelNumber = modelNumber?.takeIf { it.isNotBlank() },
                categoryId = categoryId,
            )
        val categoryIds = products.mapNotNull { it.categoryId }.distinct()
        val categoryMap =
            if (categoryIds.isNotEmpty()) {
                categoryRepository.findAllByIdIn(categoryIds).associateBy { it.id!! }
            } else {
                emptyMap()
            }
        return products.map { it.toDto(categoryMap[it.categoryId]?.toDto()) }
    }

    @Transactional
    fun create(request: ProductCreateRequestDto): ProductResponseDto {
        if (request.name.isBlank()) throw BadRequestException("Product name is required")
        val product =
            Product(
                grade = request.grade,
                modelNumber = request.modelNumber?.takeIf { it.isNotBlank() },
                name = request.name,
                releaseYear = request.releaseYear,
                releaseMonth = request.releaseMonth,
                currency = request.currency?.takeIf { it.isNotBlank() },
                price = request.price,
                manualUrl = request.manualUrl?.takeIf { it.isNotBlank() },
                categoryId = request.categoryId,
            )
        val saved = productRepository.save(product)
        val category = saved.categoryId?.let { categoryRepository.findById(it).orElse(null) }
        return saved.toDto(category?.toDto())
    }

    @Transactional
    fun update(
        id: Long,
        request: ProductUpdateRequestDto,
    ): ProductResponseDto {
        val product = productRepository.findById(id).orElseThrow { NotFoundException("Product not found: $id") }
        product.grade = request.grade
        product.modelNumber = request.modelNumber?.takeIf { it.isNotBlank() }
        product.name = request.name
        product.releaseYear = request.releaseYear
        product.releaseMonth = request.releaseMonth
        product.currency = request.currency?.takeIf { it.isNotBlank() }
        product.price = request.price
        product.manualUrl = request.manualUrl?.takeIf { it.isNotBlank() }
        product.categoryId = request.categoryId
        val category = product.categoryId?.let { categoryRepository.findById(it).orElse(null) }
        return product.toDto(category?.toDto())
    }

    @Transactional
    fun delete(id: Long) {
        val product = productRepository.findById(id).orElseThrow { NotFoundException("Product not found: $id") }
        product.deleted = true
    }

    @Transactional
    fun uploadBoxArt(
        id: Long,
        file: MultipartFile,
    ): ProductResponseDto {
        log.debug {
            "uploadBoxArt: productId=$id, originalFilename=${file.originalFilename}, contentType=${file.contentType}, size=${file.size} bytes"
        }
        val product = productRepository.findById(id).orElseThrow { NotFoundException("Product not found: $id") }
        val ext = file.originalFilename?.substringAfterLast('.', "jpg")?.lowercase() ?: "jpg"
        log.debug { "uploadBoxArt: detected extension=$ext" }
        val uuid = UUID.randomUUID().toString()
        val origPath = originalDir().resolve("$uuid.original.$ext")
        val thumbPath = thumbnailDir().resolve("$uuid.thumbnail.jpg")
        log.debug { "uploadBoxArt: origPath=$origPath, thumbPath=$thumbPath" }

        file.transferTo(origPath)
        log.debug { "uploadBoxArt: file transferred to disk, size=${Files.size(origPath)} bytes" }

        ImageUtils.createThumbnail(origPath, thumbPath)
        log.debug { "uploadBoxArt: thumbnail created, size=${Files.size(thumbPath)} bytes" }

        deleteBoxArtFiles(product)
        product.boxArtPath = origPath.toString()
        product.boxArtThumbPath = thumbPath.toString()
        log.debug { "uploadBoxArt: product[$id] paths updated → boxArtPath=$origPath, boxArtThumbPath=$thumbPath" }

        val category = product.categoryId?.let { categoryRepository.findById(it).orElse(null) }
        return product.toDto(category?.toDto())
    }

    @Transactional
    fun deleteBoxArt(id: Long): ProductResponseDto {
        val product = productRepository.findById(id).orElseThrow { NotFoundException("Product not found: $id") }
        deleteBoxArtFiles(product)
        product.boxArtPath = null
        product.boxArtThumbPath = null
        val category = product.categoryId?.let { categoryRepository.findById(it).orElse(null) }
        return product.toDto(category?.toDto())
    }

    @Transactional
    fun updateBoxArtUrl(
        id: Long,
        url: String,
    ): ProductResponseDto {
        log.debug { "updateBoxArtUrl: productId=$id, url=$url" }
        val product = productRepository.findById(id).orElseThrow { NotFoundException("Product not found: $id") }
        val urlObj = URI(url).toURL()
        val rawExt = urlObj.path.substringAfterLast('.', "").lowercase()
        val ext = if (rawExt.length in 2..4) rawExt else "jpg"
        log.debug { "updateBoxArtUrl: rawExt=$rawExt → ext=$ext" }
        val uuid = UUID.randomUUID().toString()
        val origPath = originalDir().resolve("$uuid.original.$ext")
        val thumbPath = thumbnailDir().resolve("$uuid.thumbnail.jpg")
        log.debug { "updateBoxArtUrl: origPath=$origPath, thumbPath=$thumbPath" }

        val bytes = urlObj.readBytes()
        log.debug { "updateBoxArtUrl: downloaded ${bytes.size} bytes from $url" }
        Files.write(origPath, bytes)
        log.debug { "updateBoxArtUrl: original saved to disk" }

        ImageUtils.createThumbnail(origPath, thumbPath)
        log.debug { "updateBoxArtUrl: thumbnail created, size=${Files.size(thumbPath)} bytes" }

        deleteBoxArtFiles(product)
        product.boxArtPath = origPath.toString()
        product.boxArtThumbPath = thumbPath.toString()
        log.debug { "updateBoxArtUrl: product[$id] paths updated → boxArtPath=$origPath, boxArtThumbPath=$thumbPath" }

        val category = product.categoryId?.let { categoryRepository.findById(it).orElse(null) }
        return product.toDto(category?.toDto())
    }

    private fun originalDir(): Path {
        val dir = Path.of(appProperties.boxArt.originalDirectory).toAbsolutePath()
        Files.createDirectories(dir)
        return dir
    }

    private fun thumbnailDir(): Path {
        val dir = Path.of(appProperties.boxArt.thumbnailDirectory).toAbsolutePath()
        Files.createDirectories(dir)
        return dir
    }

    private fun deleteBoxArtFiles(product: Product) {
        log.debug {
            "deleteBoxArtFiles: productId=${product.id}, boxArtPath=${product.boxArtPath}, boxArtThumbPath=${product.boxArtThumbPath}"
        }
        product.boxArtPath?.let { deleteFile(Path.of(it)) }
        product.boxArtThumbPath?.let { deleteFile(Path.of(it)) }
    }

    private fun String.toBoxArtServingUrl(): String {
        val origAbs = Path.of(appProperties.boxArt.originalDirectory).toAbsolutePath().toString()
        val thumbAbs = Path.of(appProperties.boxArt.thumbnailDirectory).toAbsolutePath().toString()
        val fileName = Path.of(this).fileName.toString()
        val prefix = contextPath.trimEnd('/')
        return when {
            startsWith(origAbs) -> "$prefix/box-art/original/$fileName"
            startsWith(thumbAbs) -> "$prefix/box-art/thumbnail/$fileName"
            else -> this
        }
    }

    private fun deleteFile(path: Path) {
        try {
            if (Files.deleteIfExists(path)) {
                log.debug { "deleteFile: deleted $path" }
            } else {
                log.warn { "deleteFile: file not found on disk, skipping: $path" }
            }
        } catch (e: Exception) {
            log.warn(e) { "deleteFile: failed to delete $path" }
        }
    }

    private fun Category.toDto() = CategoryResponseDto(id = id!!, name = name, color = color, sortOrder = sortOrder)

    private fun Product.toDto(category: CategoryResponseDto?) =
        ProductResponseDto(
            id = id!!,
            grade = grade,
            boxArtUrl = boxArtPath?.toBoxArtServingUrl(),
            boxArtThumbUrl = boxArtThumbPath?.toBoxArtServingUrl(),
            modelNumber = modelNumber,
            name = name,
            releaseYear = releaseYear,
            releaseMonth = releaseMonth,
            currency = currency,
            price = price,
            manualUrl = manualUrl,
            category = category,
            createdAt = createdAt,
            updatedAt = updatedAt,
        )
}
