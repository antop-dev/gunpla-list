package ai.antop.gunpla.common.config

import ai.antop.gunpla.admin.filter.CaptchaFilter
import ai.antop.gunpla.user.controller.UserLoginController
import ai.antop.gunpla.user.filter.BlockedUserFilter
import ai.antop.gunpla.user.service.AdminUserService
import ai.antop.gunpla.user.service.OAuthUserService
import jakarta.servlet.http.HttpServletResponse
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.annotation.Order
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.crypto.factory.PasswordEncoderFactories
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter
import org.springframework.security.web.context.DelegatingSecurityContextRepository
import org.springframework.security.web.context.HttpSessionSecurityContextRepository
import org.springframework.security.web.context.RequestAttributeSecurityContextRepository
import org.springframework.security.web.context.SecurityContextHolderFilter
import org.springframework.security.web.header.writers.DelegatingRequestMatcherHeaderWriter
import org.springframework.security.web.header.writers.StaticHeadersWriter
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher

@Configuration
@EnableWebSecurity
class SecurityConfig(
    private val oAuthUserService: OAuthUserService,
    private val adminUserService: AdminUserService,
) {
    companion object {
        // 어드민 세션을 별도 키에 저장하여 사용자 OAuth2 로그인이 어드민 세션을 덮어쓰지 않도록 분리
        private const val ADMIN_SESSION_KEY = "ADMIN_SECURITY_CONTEXT"
        private const val ADMIN_LOGIN_URL = "/admin/login"

        // 업로드된 박스아트가 HTML/스크립트로 해석되지 않도록 샌드박스 CSP 를 붙인다 (이미지 표시에는 영향 없음)
        private val boxArtCspWriter =
            DelegatingRequestMatcherHeaderWriter(
                PathPatternRequestMatcher.withDefaults().matcher("/box-art/**"),
                StaticHeadersWriter("Content-Security-Policy", "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox"),
            )
    }

    @Bean
    fun passwordEncoder() = PasswordEncoderFactories.createDelegatingPasswordEncoder()

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
    fun adminSecurityFilterChain(
        http: HttpSecurity,
        cageProperties: CageProperties,
    ): SecurityFilterChain {
        http
            .securityMatcher("/admin", "/admin/**", "/api/admin/**")
            .securityContext { it.securityContextRepository(adminContextRepository()) }
            // XSRF-TOKEN 쿠키 → JS 는 X-XSRF-TOKEN 헤더(common.js Api), Thymeleaf 폼은 _csrf 히든 필드로 전달
            .csrf { it.spa() }
            .authorizeHttpRequests {
                it.requestMatchers("/admin/login", "/admin/captcha").permitAll()
                it.anyRequest().hasRole("ADMIN")
            }.addFilterBefore(CaptchaFilter(cageProperties), UsernamePasswordAuthenticationFilter::class.java)
            .formLogin {
                it.loginPage(ADMIN_LOGIN_URL)
                it.loginProcessingUrl(ADMIN_LOGIN_URL)
                it.defaultSuccessUrl("/admin/dashboard", true)
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
            .csrf { it.spa() }
            .headers { it.addHeaderWriter(boxArtCspWriter) }
            .authorizeHttpRequests {
                it
                    .requestMatchers(
                        "/",
                        "/api/products/**",
                        "/box-art/**",
                        "/vendor/**",
                        "/css/**",
                        "/js/**",
                        "/favicon/**",
                    ).permitAll()
                it.requestMatchers("/api/user/**").authenticated()
                // 요청 현황 등 개인화 페이지 — 미인증이면 Google 로그인으로 리다이렉트된다
                it.requestMatchers("/my/**").authenticated()
                it.anyRequest().permitAll()
            }
            // 이미 로그인된 상태에서 어드민에게 차단된 사용자를 로그아웃시킨다 — 인가 판단 전에 실행되어야 한다
            .addFilterAfter(BlockedUserFilter(adminUserService), SecurityContextHolderFilter::class.java)
            .oauth2Login {
                // 헤더 로그인 버튼(UserLoginController)이 세션에 남긴 페이지로 돌아간다 — 없으면 제품 목록("/")
                it.successHandler { request, response, _ ->
                    val session = request.getSession(false)
                    val target =
                        (session?.getAttribute(UserLoginController.LOGIN_REDIRECT_ATTR) as? String)
                            ?.takeIf { UserLoginController.isSafeRedirect(it) } ?: "/"
                    session?.removeAttribute(UserLoginController.LOGIN_REDIRECT_ATTR)
                    response.sendRedirect(request.contextPath + target)
                }
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
