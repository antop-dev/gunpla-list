# 건담 목록 (Gunpla List)

건담 프라모델(건프라) 목록을 조회하고 보유 현황을 기록하는 웹 애플리케이션입니다.

## 기술 스택

| 분류 | 기술 |
|------|------|
| Language | Kotlin 2.3 |
| Framework | Spring Boot 4.1 |
| ORM | Spring Data JPA (Hibernate) |
| Database | SQLite |
| Migration | Flyway |
| Security | Spring Security + Google OAuth2 |
| Template | Thymeleaf |
| Frontend | AG Grid Community, Font Awesome |
| PWA | Web App Manifest, Service Worker |
| CAPTCHA | Cage 1.0 (Gimpy 스타일) |
| Build | Gradle (Kotlin DSL), ktlint |

## 주요 기능

### 사용자 페이지 (`/`)
- **PWA 지원** — 홈 화면 추가, 오프라인 캐시(정적 자산·제품 목록)
- 건프라 제품 목록 조회 (AG Grid)
- 구분 / 등급 / 형식번호 / 제품명 검색 및 필터
- Google 계정으로 로그인 (OAuth2)
- 로그인 후 제품 보유 여부 토글
- 로그인 후 구매일시 / 구매처 / 구매가격 / 데칼 기록
- 제품 상세 팝업 (박스아트, 매뉴얼 링크 등)
- 박스아트 이미지 라이트박스

### 관리자 페이지 (`/admin`)
- ID / 비밀번호 + **CAPTCHA 이미지 인증** 로그인 (별도 세션)
- 제품 등록 / 수정 / 삭제 (소프트 딜리트)
- 박스아트 이미지 업로드 또는 URL로 등록 (썸네일 자동 생성)
- 카테고리 관리 (이름, 색상, 정렬 순서)

## 프로젝트 구조

```
src/main/kotlin/ia/antop/gunpla/
├── admin/
│   ├── controller/   # AdminPageController, AdminAccountController, CaptchaController
│   ├── entity/
│   ├── filter/       # CaptchaFilter (로그인 전 CAPTCHA 검증)
│   ├── repository/
│   └── service/
├── category/         # 카테고리
├── common/
│   ├── config/       # SecurityConfig, AppProperties, CageConfig, CageProperties, WebMvcConfig
│   ├── exception/
│   └── util/
├── product/          # 제품
└── user/             # 사용자 계정, 보유 제품
```

## 설정값

`application.yml` 기준 환경변수:

| 환경변수 | 설명 | 기본값 |
|----------|------|--------|
| `DB_PATH` | SQLite DB 파일 경로 | `./data/gunpla-list.db` |
| `BASE_URL` | 서비스 베이스 URL | `http://localhost:8080` |
| `GOOGLE_CLIENT_ID` | Google OAuth2 Client ID | - |
| `GOOGLE_CLIENT_SECRET` | Google OAuth2 Client Secret | - |
| `BOX_ART_ORIGINAL_DIRECTORY` | 박스아트 원본 저장 경로 | `./data/boxart/original` |
| `BOX_ART_THUMBNAIL_DIRECTORY` | 박스아트 썸네일 저장 경로 | `./data/boxart/thumbnail` |
| `CAGE_SESSION_KEY` | CAPTCHA 토큰 세션 키 이름 | `CAGE_TOKEN` |

## CAPTCHA 동작 방식

관리자 로그인 폼에는 [Cage](https://github.com/akiraly/cage) 라이브러리 기반 이미지 CAPTCHA가 적용되어 있습니다.

```
GET /admin/captcha
  → Cage 로 이미지 생성 (GCage / Gimpy 스타일, jpeg)
  → 생성된 토큰을 세션(CAGE_SESSION_KEY)에 저장
  → 이미지 반환 (Cache-Control: no-cache)

POST /admin/login
  → CaptchaFilter (UsernamePasswordAuthenticationFilter 앞에서 실행)
  → 세션 토큰 vs 입력값 대소문자 무시 비교
  → 불일치: /admin/login?captchaError 리다이렉트 (세션 토큰 즉시 삭제)
  → 일치:  Spring Security 자격증명 검증으로 진행
```

- 로그인 폼에서 CAPTCHA 이미지를 클릭하면 새 이미지를 요청합니다.
- `?error` — 아이디/비밀번호 오류, `?captchaError` — 보안 코드 오류로 에러를 구분합니다.

## 실행

### 로컬 개발

```bash
./gradlew bootRun --args='--spring.profiles.active=local'
```

### 빌드

```bash
./gradlew build
```

### 코드 스타일 검사 / 자동 포맷

```bash
./gradlew ktlintCheck
./gradlew ktlintFormat
```

## 박스아트 이미지 제공 경로

| 경로 | 설명 |
|------|------|
| `/box-art/original/**` | 원본 이미지 |
| `/box-art/thumbnail/**` | 썸네일 이미지 |

## PWA 동작 방식

사용자 페이지는 Web App Manifest + Service Worker 기반 PWA로 동작합니다.

```
manifest.json (favicon/manifest.json)
  → name, short_name, icons, start_url, display: standalone
  → theme_color / background_color: #1a1a2e (다크 테마)

sw.js (컨텍스트 루트에서 서빙)
  → install: CSS/JS/벤더 파일 사전 캐시
  → activate: 이전 버전 캐시 삭제
  → fetch:
      /api/products/** → Network-first (오프라인 시 캐시 응답)
      /css/, /js/, /vendor/, /favicon/ → Cache-first
      그 외 → Network-first
```

- 서비스 워커 경로는 `window.CONTEXT_PATH`를 사용하여 컨텍스트 경로를 자동 반영합니다.
- 모바일 브라우저에서 "홈 화면에 추가" 시 앱처럼 독립 실행됩니다.
