package ia.antop.gunpla.user.entity

import jakarta.persistence.*
import java.time.LocalDateTime
import java.time.ZoneOffset

// Google OAuth2 로그인 사용자 계정
// google_id 는 OAuth2 "sub" 클레임으로, 계정 삭제/재생성 후에도 변하지 않는 안정적인 식별자
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
    // name / picture 는 매 로그인 시 Google 프로필에서 최신값으로 갱신됨 (OAuthUserService 참조)
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
