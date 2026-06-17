package ia.antop.gunpla.user.service

import ia.antop.gunpla.user.entity.UserAccount
import ia.antop.gunpla.user.repository.UserAccountRepository
import org.slf4j.LoggerFactory
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest
import org.springframework.security.oauth2.core.user.OAuth2User
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class OAuthUserService(
    private val userAccountRepository: UserAccountRepository,
) : org.springframework.security.oauth2.client.userinfo.OAuth2UserService<OAuth2UserRequest, OAuth2User> {
    private val log = LoggerFactory.getLogger(this::class.java)
    private val delegate = DefaultOAuth2UserService()

    @Transactional
    override fun loadUser(userRequest: OAuth2UserRequest): OAuth2User {
        val oAuth2User = delegate.loadUser(userRequest)

        val googleId = oAuth2User.getAttribute<String>("sub") ?: return oAuth2User
        val name = oAuth2User.getAttribute<String>("name")
        val picture = oAuth2User.getAttribute<String>("picture")

        val existing = userAccountRepository.findByGoogleId(googleId)
        if (existing == null) {
            userAccountRepository.save(UserAccount(googleId = googleId, name = name, picture = picture))
            log.info("New user registered. googleId={}", googleId)
        } else {
            existing.name = name
            existing.picture = picture
        }

        return oAuth2User
    }
}
