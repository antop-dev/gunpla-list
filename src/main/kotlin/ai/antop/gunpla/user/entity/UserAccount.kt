package ai.antop.gunpla.user.entity

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
    // 신규 판매제품 알림 수신 동의 여부 — 신규 생성/기본값은 항상 미동의(false)
    @Column(name = "notify_on_sale", nullable = false)
    var notifyOnSale: Boolean = false,
    // 알림을 받을 이메일 주소 — null 이면 알림 설정 화면에서 email 을 기본값으로 보여준다
    @Column(name = "notify_email")
    var notifyEmail: String? = null,
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
