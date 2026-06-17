package ia.antop.gunpla.common.config

import ia.antop.gunpla.user.service.OAuthUserService
import jakarta.servlet.http.HttpServletResponse
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.annotation.Order
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.context.DelegatingSecurityContextRepository
import org.springframework.security.web.context.HttpSessionSecurityContextRepository
import org.springframework.security.web.context.RequestAttributeSecurityContextRepository

@Configuration
@EnableWebSecurity
class SecurityConfig(
    private val oAuthUserService: OAuthUserService,
) {
    companion object {
        private const val ADMIN_SESSION_KEY = "ADMIN_SECURITY_CONTEXT"
        private const val ADMIN_LOGIN_URL = "/admin/login"
    }

    @Bean
    fun passwordEncoder(): PasswordEncoder = BCryptPasswordEncoder()

    /**
     * Admin context is stored under a separate session key (ADMIN_SECURITY_CONTEXT)
     * so that Google OAuth2 login on the user chain cannot overwrite it.
     */
    private fun adminContextRepository() =
        DelegatingSecurityContextRepository(
            RequestAttributeSecurityContextRepository(),
            HttpSessionSecurityContextRepository().apply {
                setSpringSecurityContextKey(ADMIN_SESSION_KEY)
            },
        )

    @Bean
    @Order(1)
    fun adminSecurityFilterChain(http: HttpSecurity): SecurityFilterChain {
        http
            .securityMatcher("/admin", "/admin/**", "/api/admin/**")
            .securityContext { it.securityContextRepository(adminContextRepository()) }
            .csrf { it.disable() }
            .authorizeHttpRequests {
                it.requestMatchers("/admin/login").permitAll()
                it.anyRequest().hasRole("ADMIN")
            }.formLogin {
                it.loginPage(ADMIN_LOGIN_URL)
                it.loginProcessingUrl(ADMIN_LOGIN_URL)
                it.defaultSuccessUrl("/admin/products", true)
                it.failureUrl("$ADMIN_LOGIN_URL?error")
                it.usernameParameter("username")
                it.passwordParameter("password")
            }.logout {
                it.logoutUrl("/admin/logout")
                it.logoutSuccessUrl(ADMIN_LOGIN_URL)
                it.invalidateHttpSession(false)
                it.deleteCookies()
            }
        return http.build()
    }

    @Bean
    @Order(2)
    fun userSecurityFilterChain(http: HttpSecurity): SecurityFilterChain {
        http
            .csrf { it.disable() }
            .authorizeHttpRequests {
                it.requestMatchers("/", "/api/products/**", "/box-art/**", "/vendor/**", "/css/**", "/js/**", "/favicon/**").permitAll()
                it.requestMatchers("/api/user/**").authenticated()
                it.anyRequest().permitAll()
            }.oauth2Login {
                it.defaultSuccessUrl("/", true)
                it.failureUrl("/")
                it.userInfoEndpoint { endpoint ->
                    endpoint.userService(oAuthUserService)
                }
            }.logout {
                it.logoutUrl("/logout")
                it.logoutSuccessUrl("/")
                it.invalidateHttpSession(false)
                it.deleteCookies()
            }.exceptionHandling {
                it.authenticationEntryPoint { request, response, _ ->
                    if (request.requestURI.startsWith(request.contextPath + "/api/")) {
                        response.status = HttpServletResponse.SC_UNAUTHORIZED
                        response.contentType = "application/json;charset=UTF-8"
                        response.writer.write("{\"message\":\"Unauthorized\"}")
                    } else {
                        response.sendRedirect(request.contextPath + "/oauth2/authorization/google")
                    }
                }
            }
        return http.build()
    }
}
