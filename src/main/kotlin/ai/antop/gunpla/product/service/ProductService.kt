package ai.antop.gunpla.product.service

import ai.antop.gunpla.category.dto.CategoryResponseDto
import ai.antop.gunpla.category.entity.Category
import ai.antop.gunpla.category.repository.CategoryRepository
import ai.antop.gunpla.common.config.AppProperties
import ai.antop.gunpla.common.exception.BadRequestException
import ai.antop.gunpla.common.exception.NotFoundException
import ai.antop.gunpla.common.shorty.UrlShortenerService
import ai.antop.gunpla.common.util.ImageUtils
import ai.antop.gunpla.product.dto.ProductBoxArtResponseDto
import ai.antop.gunpla.product.dto.ProductCreateRequestDto
import ai.antop.gunpla.product.dto.ProductResponseDto
import ai.antop.gunpla.product.dto.ProductUpdateRequestDto
import ai.antop.gunpla.product.entity.Product
import ai.antop.gunpla.product.entity.ProductBoxArt
import jakarta.persistence.criteria.Predicate
import org.springframework.data.domain.Sort
import org.springframework.data.jpa.domain.Specification
import ai.antop.gunpla.product.repository.ProductBoxArtRepository
import ai.antop.gunpla.product.repository.ProductRepository
import ai.antop.gunpla.variation.repository.VariationNodeRepository
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpHeaders
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.multipart.MultipartFile
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse.BodyHandlers
import java.nio.file.Files
import java.nio.file.Path
import java.util.UUID
import javax.imageio.ImageIO

private val log = KotlinLogging.logger {}

@Service
class ProductService(
    private val productRepository: ProductRepository,
    private val productBoxArtRepository: ProductBoxArtRepository,
    private val categoryRepository: CategoryRepository,
    private val appProperties: AppProperties,
    private val urlShortenerService: UrlShortenerService,
    private val variationNodeRepository: VariationNodeRepository,
    // context-path 는 nginx 리버스 프록시 하위 경로 지원을 위해 박스아트 URL 앞에 붙임
    @Value("\${server.servlet.context-path:}") private val contextPath: String,
) {
    // 카테고리 조회를 N+1 없이 처리하기 위해 productId 기준 Map 으로 일괄 조회
    @Transactional(readOnly = true)
    fun search(
        name: String? = null,
        grade: String? = null,
        modelNumber: String? = null,
        categoryId: Long? = null,
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
        return toDtos(products)
    }

    // 어드민 제품 관리 목록 — 검색 조건과 정렬을 서버에서 처리한다 (논리 삭제 제외)
    @Transactional(readOnly = true)
    fun searchForAdmin(
        grade: String?,
        categoryId: Long?,
        name: String?,
        modelNumber: String?,
        series: String?,
        hasBoxArt: Boolean?,
        hasManual: Boolean?,
        sortBy: String?,
        sortDir: String?,
    ): List<ProductResponseDto> {
        val spec =
            Specification<Product> { root, query, cb ->
                val predicates = mutableListOf<Predicate>(cb.isFalse(root.get("deleted")))
                grade?.takeIf { it.isNotBlank() }?.let { predicates += cb.equal(root.get<String>("grade"), it) }
                categoryId?.let { predicates += cb.equal(root.get<Long>("categoryId"), it) }
                // 제품명은 공백으로 나눈 단어가 모두 (순서 무관) 포함돼야 한다
                name?.trim()?.lowercase()?.split(Regex("""\s+"""))?.filter { it.isNotEmpty() }?.forEach {
                    predicates += cb.like(cb.lower(root.get("name")), "%$it%")
                }
                modelNumber?.trim()?.lowercase()?.takeIf { it.isNotEmpty() }?.let {
                    predicates += cb.like(cb.lower(root.get("modelNumber")), "%$it%")
                }
                series?.trim()?.lowercase()?.takeIf { it.isNotEmpty() }?.let {
                    predicates += cb.like(cb.lower(root.get("series")), "%$it%")
                }
                hasBoxArt?.let {
                    val sub = query!!.subquery(Long::class.java)
                    val boxArt = sub.from(ProductBoxArt::class.java)
                    sub.select(boxArt.get("id")).where(cb.equal(boxArt.get<Long>("productId"), root.get<Long>("id")))
                    predicates += if (it) cb.exists(sub) else cb.not(cb.exists(sub))
                }
                // 매뉴얼이 없으면 컨버터가 null 로 저장한다
                hasManual?.let {
                    predicates += if (it) cb.isNotNull(root.get<Any>("manualUrls")) else cb.isNull(root.get<Any>("manualUrls"))
                }
                cb.and(*predicates.toTypedArray())
            }
        val direction = if (sortDir.equals("asc", ignoreCase = true)) Sort.Direction.ASC else Sort.Direction.DESC
        val properties =
            when (sortBy) {
                "modelNumber" -> listOf("modelNumber")
                "name" -> listOf("name")
                "price" -> listOf("price")
                "series" -> listOf("series")
                else -> listOf("releaseYear", "releaseMonth") // releaseDate (기본)
            }
        val sort = Sort.by(properties.map { Sort.Order(direction, it) } + Sort.Order(Sort.Direction.DESC, "id"))
        return toDtos(productRepository.findAll(spec, sort))
    }

    // 카테고리 조회를 N+1 없이 처리하기 위해 productId 기준 Map 으로 일괄 조회
    private fun toDtos(products: List<Product>): List<ProductResponseDto> {
        val categoryIds = products.mapNotNull { it.categoryId }.distinct()
        val categoryMap =
            if (categoryIds.isNotEmpty()) {
                categoryRepository.findAllByIdIn(categoryIds).associateBy { it.id!! }
            } else {
                emptyMap()
            }
        // 바리에이션 구성도 보드는 제품 수에 비해 훨씬 적으므로 IN 절 대신 전체를 읽어 Map 으로 만든다 (SQLite 바인딩 변수 개수 제한 회피)
        val variationIdMap = variationNodeRepository.findAll().associate { it.productId to it.variationId }
        // 박스아트도 같은 이유로 전체를 읽어 제품별로 묶는다 (정렬 순서 유지)
        val boxArtMap = productBoxArtRepository.findAllByOrderBySortOrderAscIdAsc().groupBy { it.productId }
        return products.map {
            it.toDto(categoryMap[it.categoryId]?.toDto(), variationIdMap[it.id], boxArtMap[it.id].orEmpty())
        }
    }

    // 바리에이션 구성도에 올린 제품들을 조회 — 논리 삭제된 제품은 제외한다
    @Transactional(readOnly = true)
    fun findAllByIds(ids: Collection<Long>): List<ProductResponseDto> {
        if (ids.isEmpty()) return emptyList()
        val products = productRepository.findAllById(ids).filter { !it.deleted }
        val categoryIds = products.mapNotNull { it.categoryId }.distinct()
        val categoryMap =
            if (categoryIds.isNotEmpty()) {
                categoryRepository.findAllByIdIn(categoryIds).associateBy { it.id!! }
            } else {
                emptyMap()
            }
        val variationIdMap = variationNodeRepository.findAllByProductIdIn(ids).associate { it.productId to it.variationId }
        val boxArtMap = productBoxArtRepository.findAllByProductIdInOrderBySortOrderAscIdAsc(ids).groupBy { it.productId }
        return products.map {
            it.toDto(categoryMap[it.categoryId]?.toDto(), variationIdMap[it.id], boxArtMap[it.id].orEmpty())
        }
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
                // 메뉴얼/출처 URL 은 Shorty 짧은 URL 로 변환해서 저장한다
                manualUrls = shortenAll(request.manualUrls),
                sourceUrl = urlShortenerService.shorten(request.sourceUrl),
                series = request.series?.takeIf { it.isNotBlank() },
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
        // 메뉴얼/출처 URL 은 Shorty 짧은 URL 로 변환해서 저장한다
        // (이미 단축된 값이면 UrlShortenerService 가 Shorty 호출 없이 그대로 돌려주므로 중복 단축은 발생하지 않는다)
        product.manualUrls = shortenAll(request.manualUrls)
        product.sourceUrl = urlShortenerService.shorten(request.sourceUrl)
        product.series = request.series?.takeIf { it.isNotBlank() }
        product.categoryId = request.categoryId
        val category = product.categoryId?.let { categoryRepository.findById(it).orElse(null) }
        return product.toDto(category?.toDto())
    }

    @Transactional
    fun delete(id: Long) {
        val product = productRepository.findById(id).orElseThrow { NotFoundException("Product not found: $id") }
        // 물리 삭제 대신 논리 삭제 — user_product 참조를 유지하기 위함
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

        // 기존 박스아트는 그대로 두고 맨 뒤에 추가한다
        appendBoxArt(id, origPath, thumbPath)
        log.debug { "uploadBoxArt: product[$id] box art appended → boxArtPath=$origPath, boxArtThumbPath=$thumbPath" }

        val category = product.categoryId?.let { categoryRepository.findById(it).orElse(null) }
        return product.toDto(category?.toDto())
    }

    @Transactional
    fun deleteBoxArt(
        id: Long,
        boxArtId: Long,
    ): ProductResponseDto {
        val product = productRepository.findById(id).orElseThrow { NotFoundException("Product not found: $id") }
        val boxArt =
            productBoxArtRepository
                .findById(boxArtId)
                .filter { it.productId == id }
                .orElseThrow { NotFoundException("Box art not found: $boxArtId") }
        deleteBoxArtFiles(boxArt)
        productBoxArtRepository.delete(boxArt)
        val category = product.categoryId?.let { categoryRepository.findById(it).orElse(null) }
        return product.toDto(category?.toDto())
    }

    // 넘겨받은 id 순서대로 sort_order 를 다시 매긴다 — 목록에 빠진 박스아트는 맨 뒤로 보낸다(기존 순서 유지)
    @Transactional
    fun reorderBoxArts(
        id: Long,
        ids: List<Long>,
    ): ProductResponseDto {
        val product = productRepository.findById(id).orElseThrow { NotFoundException("Product not found: $id") }
        val boxArts = productBoxArtRepository.findAllByProductIdOrderBySortOrderAscIdAsc(id)
        val orderMap = ids.withIndex().associate { (index, boxArtId) -> boxArtId to index }
        boxArts
            .sortedBy { orderMap[it.id] ?: Int.MAX_VALUE }
            .forEachIndexed { index, boxArt -> boxArt.sortOrder = index }
        val category = product.categoryId?.let { categoryRepository.findById(it).orElse(null) }
        return product.toDto(category?.toDto(), boxArts = boxArts.sortedBy { it.sortOrder })
    }

    @Transactional
    fun updateBoxArtUrl(
        id: Long,
        url: String,
    ): ProductResponseDto {
        log.debug { "updateBoxArtUrl: productId=$id, url=$url" }
        val product = productRepository.findById(id).orElseThrow { NotFoundException("Product not found: $id") }
        // 외부 URL 이미지를 로컬 파일시스템으로 다운로드하여 저장 (CDN 링크 소실 방지)
        val rawExt = URI(url).path.substringAfterLast('.', "").lowercase()
        val downloaded = downloadImage(url)
        log.debug { "updateBoxArtUrl: downloaded ${downloaded.size} bytes from $url" }

        // 스크래핑한 박스아트는 대부분 흰 배경 여백이 있으므로 잘라낸 뒤 저장한다(JPEG 로 재인코딩됨).
        // ImageIO 가 읽지 못하는 포맷(webp 등)이면 원본 그대로 저장
        val trimmed = ImageIO.read(downloaded.inputStream())?.let { ImageUtils.trimWhitespaceToJpegBytes(it) }
        val bytes = trimmed ?: downloaded
        val ext =
            when {
                trimmed != null -> "jpg"
                rawExt.length in 2..4 -> rawExt
                else -> "jpg"
            }
        log.debug { "updateBoxArtUrl: rawExt=$rawExt → ext=$ext, trimmed=${trimmed != null}, size=${bytes.size} bytes" }

        val uuid = UUID.randomUUID().toString()
        val origPath = originalDir().resolve("$uuid.original.$ext")
        val thumbPath = thumbnailDir().resolve("$uuid.thumbnail.jpg")
        log.debug { "updateBoxArtUrl: origPath=$origPath, thumbPath=$thumbPath" }

        Files.write(origPath, bytes)
        log.debug { "updateBoxArtUrl: original saved to disk" }

        ImageUtils.createThumbnail(origPath, thumbPath)
        log.debug { "updateBoxArtUrl: thumbnail created, size=${Files.size(thumbPath)} bytes" }

        appendBoxArt(id, origPath, thumbPath)
        log.debug { "updateBoxArtUrl: product[$id] box art appended → boxArtPath=$origPath, boxArtThumbPath=$thumbPath" }

        val category = product.categoryId?.let { categoryRepository.findById(it).orElse(null) }
        return product.toDto(category?.toDto())
    }

    // 이미 디스크에 저장된 이미지(사용자 요청에 첨부된 박스아트)를 제품 박스아트 맨 뒤에 추가한다
    // (기존 박스아트를 지우지 않는다 — 순서 변경/삭제는 관리자가 제품 수정 팝업에서 한다)
    // 원본을 그대로 참조하지 않고 복사하는 이유: 요청 이력 화면이 계속 원본 파일을 참조하므로,
    // 이후 제품 박스아트를 교체/삭제할 때 요청 이력의 이미지까지 사라지지 않게 하기 위함
    @Transactional
    fun addBoxArtFiles(
        id: Long,
        originalPath: String,
        thumbPath: String,
    ): ProductResponseDto {
        val product = productRepository.findById(id).orElseThrow { NotFoundException("Product not found: $id") }
        val source = Path.of(originalPath)
        val ext = source.fileName.toString().substringAfterLast('.', "jpg")
        val uuid = UUID.randomUUID().toString()
        val newOrigPath = originalDir().resolve("$uuid.original.$ext")
        val newThumbPath = thumbnailDir().resolve("$uuid.thumbnail.jpg")
        Files.copy(source, newOrigPath)
        Files.copy(Path.of(thumbPath), newThumbPath)
        log.debug { "addBoxArtFiles: productId=$id, copied to origPath=$newOrigPath, thumbPath=$newThumbPath" }

        appendBoxArt(id, newOrigPath, newThumbPath)

        val category = product.categoryId?.let { categoryRepository.findById(it).orElse(null) }
        return product.toDto(category?.toDto())
    }

    // 사용자 요청 비교 화면에서 제품의 현재 대표 박스아트를 보여줄 때 사용
    @Transactional(readOnly = true)
    fun findRepresentativeBoxArt(productId: Long): ProductBoxArtResponseDto? =
        productBoxArtRepository.findFirstByProductIdOrderBySortOrderAscIdAsc(productId)?.toDto()

    // 저장된 파일을 제품 박스아트 목록의 맨 뒤에 붙인다
    private fun appendBoxArt(
        productId: Long,
        origPath: Path,
        thumbPath: Path,
    ) {
        val lastOrder = productBoxArtRepository.findAllByProductIdOrderBySortOrderAscIdAsc(productId).maxOfOrNull { it.sortOrder } ?: -1
        productBoxArtRepository.save(
            ProductBoxArt(
                productId = productId,
                boxArtPath = origPath.fileName.toString(),
                boxArtThumbPath = thumbPath.fileName.toString(),
                sortOrder = lastOrder + 1,
            ),
        )
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

    private fun deleteBoxArtFiles(boxArt: ProductBoxArt) {
        log.debug {
            "deleteBoxArtFiles: productId=${boxArt.productId}, boxArtPath=${boxArt.boxArtPath}, boxArtThumbPath=${boxArt.boxArtThumbPath}"
        }
        deleteFile(originalDir().resolve(boxArt.boxArtPath))
        boxArt.boxArtThumbPath?.let { deleteFile(thumbnailDir().resolve(it)) }
    }

    // DB 에 저장된 파일명을 클라이언트가 접근 가능한 HTTP URL 로 변환
    // context-path 를 앞에 붙여 nginx 하위 경로 프록시 환경을 지원
    private fun boxArtServingUrl(
        kind: String,
        fileName: String,
    ): String = "${contextPath.trimEnd('/')}/box-art/$kind/$fileName"

    private fun downloadImage(url: String): ByteArray {
        val ua =
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"
        val accept =
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7"
        val referer = URI(url).let { "${it.scheme}://${it.host}/" }
        val client =
            HttpClient
                .newBuilder()
                .followRedirects(HttpClient.Redirect.NORMAL)
                .connectTimeout(java.time.Duration.ofSeconds(10))
                .build()

        val request =
            HttpRequest
                .newBuilder(URI(url))
                .header(HttpHeaders.USER_AGENT, ua)
                .header(HttpHeaders.ACCEPT, accept)
                .header(HttpHeaders.ACCEPT_LANGUAGE, "ko,en-US;q=0.9,en;q=0.8")
                .header(HttpHeaders.ACCEPT_ENCODING, "gzip, deflate, br, zstd")
                .header(HttpHeaders.REFERER, referer)
                .header(HttpHeaders.PRAGMA, "no-cache")
                .header("Sec-Fetch-Dest", "image")
                .header("Sec-Fetch-Mode", "no-cors")
                .header("Sec-Fetch-Site", "cross-site")
                .timeout(java.time.Duration.ofSeconds(30))
                .build()
        val response = client.send(request, BodyHandlers.ofByteArray())
        val contentType = response.headers().firstValue("content-type").orElse("-")
        log.debug { "downloadImage: HTTP ${response.statusCode()}, Content-Type=$contentType" }
        check(response.statusCode() == 200) {
            "Image download failed: HTTP ${response.statusCode()} from $url"
        }
        return response.body()
    }

    // 파일이 이미 삭제된 경우도 정상 처리 (배포 환경에서 수동 삭제된 파일 고려)
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

    // 매뉴얼 URL 은 여러 개일 수 있어 Shorty 단축을 URL 마다 적용한다
    private fun shortenAll(urls: List<String>): List<String> = urls.mapNotNull { urlShortenerService.shorten(it) }

    private fun ProductBoxArt.toDto() =
        ProductBoxArtResponseDto(
            id = id!!,
            url = boxArtServingUrl("original", boxArtPath),
            thumbUrl = boxArtThumbPath?.let { boxArtServingUrl("thumbnail", it) },
        )

    // variationId / boxArts 를 넘기지 않으면 제품 한 건을 직접 조회한다 — 목록 조회는 Map 으로 일괄 조회한 값을 넘긴다
    private fun Product.toDto(
        category: CategoryResponseDto?,
        variationId: String? = variationNodeRepository.findByProductId(id!!)?.variationId,
        boxArts: List<ProductBoxArt> = productBoxArtRepository.findAllByProductIdOrderBySortOrderAscIdAsc(id!!),
    ) = ProductResponseDto(
        id = id!!,
        grade = grade,
        boxArtUrl = boxArts.firstOrNull()?.let { boxArtServingUrl("original", it.boxArtPath) },
        boxArtThumbUrl = boxArts.firstOrNull()?.boxArtThumbPath?.let { boxArtServingUrl("thumbnail", it) },
        boxArts = boxArts.map { it.toDto() },
        modelNumber = modelNumber,
        name = name,
        releaseYear = releaseYear,
        releaseMonth = releaseMonth,
        currency = currency,
        price = price,
        manualUrls = manualUrls,
        sourceUrl = sourceUrl,
        series = series,
        category = category,
        createdAt = createdAt,
        updatedAt = updatedAt,
        variationId = variationId,
    )
}
