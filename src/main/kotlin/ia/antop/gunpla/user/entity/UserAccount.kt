package ia.antop.gunpla.user.entity

import jakarta.persistence.*
import java.time.LocalDateTime
import java.time.ZoneOffset

@Entity
@Table(name = "user_account")
class UserAccount(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    @Column(name = "google_id", unique = true, nullable = false)
    var googleId: String,
    @Column
    var email: String? = null,
    @Column
    var name: String? = null,
    @Column
    var picture: String? = null,
    @Column(name = "created_at", nullable = false)
    var createdAt: LocalDateTime = LocalDateTime.now(ZoneOffset.UTC),
    @Column(name = "updated_at", nullable = false)
    var updatedAt: LocalDateTime = LocalDateTime.now(ZoneOffset.UTC),
) {
    @PreUpdate
    fun onUpdate() {
        updatedAt = LocalDateTime.now(ZoneOffset.UTC)
    }
}
