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
        // 어드민 세션을 별도 키에 저장하여 사용자 OAuth2 로그인이 어드민 세션을 덮어쓰지 않도록 분리
        private const val ADMIN_SESSION_KEY = "ADMIN_SECURITY_CONTEXT"
        private const val ADMIN_LOGIN_URL = "/admin/login"
    }

    @Bean
    fun passwordEncoder(): PasswordEncoder = BCryptPasswordEncoder()

    // 어드민 전용 SecurityContext 저장소: 세션 키를 ADMIN_SESSION_KEY 로 격리
    private fun adminContextRepository() =
        DelegatingSecurityContextRepository(
            RequestAttributeSecurityContextRepository(),
            HttpSessionSecurityContextRepository().apply {
                setSpringSecurityContextKey(ADMIN_SESSION_KEY)
            },
        )

    // 어드민 필터체인 (Order=1, 먼저 매칭) — /admin/** 및 /api/admin/** 경로 담당
    // Form 로그인으로 인증하며, ROLE_ADMIN 이 필요
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
                // 어드민 로그아웃 시 사용자 세션은 그대로 유지 (false = 세션 무효화 안 함)
                it.invalidateHttpSession(false)
                it.deleteCookies()
            }
        return http.build()
    }

    // 사용자 필터체인 (Order=2) — Google OAuth2 인증 담당
    // /api/user/** 만 인증 필요, 나머지는 비로그인도 허용 (제품 목록 공개)
    // API 경로 미인증 시 JSON 401, 그 외 경로는 Google OAuth2 로 리다이렉트
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
                // 사용자 로그아웃 시 어드민 세션은 그대로 유지 (false = 세션 무효화 안 함)
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
