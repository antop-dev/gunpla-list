package ai.antop.gunpla.onsale.repository

import ai.antop.gunpla.onsale.entity.OnSaleScrapeLog
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.transaction.annotation.Transactional
import java.time.LocalDateTime

interface OnSaleScrapeLogRepository : JpaRepository<OnSaleScrapeLog, Long> {
    fun findAllByOrderByStartedAtDescIdDesc(): List<OnSaleScrapeLog>

    fun findAllBySourceOrderByStartedAtDescIdDesc(source: String): List<OnSaleScrapeLog>

    @Transactional
    @Modifying
    @Query("delete from OnSaleScrapeLog l where l.startedAt < :before")
    fun deleteOlderThan(before: LocalDateTime): Int
}
