package ai.antop.gunpla.productrelease.service

import ai.antop.gunpla.productrelease.dto.ProductReleaseResponseDto
import ai.antop.gunpla.productrelease.entity.ProductReleaseCheck
import ai.antop.gunpla.productrelease.repository.ProductReleaseCheckRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.time.LocalDate

// ProductScraperService 구현체(gunpla.fyi, 반다이 하비 글로벌 발매 스케줄 등)를 Spring DI 로 모두 주입받아 스크래핑한
// 제품 출시 정보를 등급별로 모아 반환 — 사이트가 추가되면 ProductScraperService 구현체(@Service)만 추가하면 됨
// DB 제품 목록과의 비교(이미 등록된 제품 제외)는 하지 않음 — 스크래핑된 전체 목록을 그대로 보여줌
// 소스마다 제품명 표기가 다를 수 있어(번역 vs 원문) 동일 제품이 중복으로 나올 수 있음 — 관리자가 최종 검수
// 관리자가 "확인완료"로 표시한 항목은 등급+출처+영문명+발매년월 해시로 product_release_check 테이블에 저장해
// (오탐 제외/이미 등록 표시) 다음 조회 때도 같은 항목을 "확인" 상태로 식별할 수 있게 함
@Service
class ProductReleaseService(
    private val scraperServices: List<ProductScraperService>,
    private val productReleaseCheckRepository: ProductReleaseCheckRepository,
) {
    @Transactional(readOnly = true)
    fun findProductReleases(): List<ProductReleaseResponseDto> {
        val checkedHashes = productReleaseCheckRepository.findAll().mapTo(mutableSetOf()) { it.hash }
        val scraped = scraperServices.flatMap { it.scrapeAll() }
        return scraped
            .groupBy { it.grade }
            .flatMap { (_, rows) -> dedupe(rows) }
            .map { row -> row.toDto(checkedHashes) }
    }

    @Transactional
    fun check(hash: String) {
        if (!productReleaseCheckRepository.existsByHash(hash)) {
            productReleaseCheckRepository.save(ProductReleaseCheck(hash = hash))
        }
    }

    @Transactional
    fun uncheck(hash: String) {
        productReleaseCheckRepository.deleteByHash(hash)
    }

    private fun dedupe(rows: List<ScrapedProductRow>): List<ScrapedProductRow> {
        val seen = mutableSetOf<String>()
        return rows.filter { seen.add(it.nameKo.normalizeName()) }
    }

    private fun ScrapedProductRow.toDto(checkedHashes: Set<String>): ProductReleaseResponseDto {
        val (year, month) = parseReleaseDate(dateText)
        val hash = computeHash(grade, source, nameEn, year, month)
        return ProductReleaseResponseDto(
            grade = grade,
            source = source,
            hash = hash,
            checked = hash in checkedHashes,
            modelNumber = modelNumber,
            nameKo = nameKo,
            nameEn = nameEn,
            nameJp = nameJp,
            releaseYear = year,
            releaseMonth = month,
            series = series,
            sourceUrl = sourceUrl,
            imageUrl = imageUrl,
            price = price,
        )
    }

    // 등급+출처+영문명+발매년월을 SHA-256 해싱 — 스크래핑할 때마다 동일 후보에 같은 값이 나와야 하므로 안정적인 원문 필드만 사용
    private fun computeHash(
        grade: String,
        source: String,
        nameEn: String?,
        releaseYear: Int?,
        releaseMonth: Int?,
    ): String {
        val raw = "$grade|$source|${nameEn.orEmpty()}|${releaseYear ?: ""}|${releaseMonth ?: ""}"
        val digest = MessageDigest.getInstance("SHA-256").digest(raw.toByteArray(StandardCharsets.UTF_8))
        return digest.joinToString("") { "%02x".format(it) }
    }

    // 발매년월은 "99.05"(2자리) 또는 "2005.11"(4자리) 형식 — 2자리는 현재 연도 기준으로 19xx/20xx 를 추정
    private fun parseReleaseDate(dateText: String?): Pair<Int?, Int?> {
        val match = dateText?.let { DATE_PATTERN.matchEntire(it) } ?: return null to null
        val (yearPart, monthPart) = match.destructured
        val month = monthPart.toInt()
        if (month !in 1..12) return null to null
        val year =
            if (yearPart.length == 4) {
                yearPart.toInt()
            } else {
                val yy = yearPart.toInt()
                val currentYy = LocalDate.now().year % 100
                if (yy <= currentYy + 1) 2000 + yy else 1900 + yy
            }
        return year to month
    }

    private fun String.normalizeName(): String = trim().replace(WHITESPACE, " ").lowercase()

    companion object {
        private val DATE_PATTERN = Regex("""^(\d{2}|\d{4})\.(\d{1,2})$""")
        private val WHITESPACE = Regex("""\s+""")
    }
}
