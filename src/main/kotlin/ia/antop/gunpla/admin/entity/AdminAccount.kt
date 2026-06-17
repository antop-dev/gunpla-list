package ia.antop.gunpla.admin.entity

import jakarta.persistence.*
import java.time.LocalDateTime
import java.time.ZoneOffset

// 어드민 계정 엔티티 — Form 로그인 인증에 사용되며 BCrypt 로 해시된 password 를 저장
@Entity
@Table(name = "admin_account")
class AdminAccount(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    @Column(unique = true, nullable = false)
    var username: String,
    @Column(nullable = false)
    var password: String,
    @Column(name = "created_at", nullable = false)
    var createdAt: LocalDateTime = LocalDateTime.now(ZoneOffset.UTC),
)
