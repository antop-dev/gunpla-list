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
| Build | Gradle (Kotlin DSL), ktlint |

## 주요 기능

### 사용자 페이지 (`/`)
- 건프라 제품 목록 조회 (AG Grid)
- 구분 / 등급 / 형식번호 / 제품명 검색 및 필터
- Google 계정으로 로그인 (OAuth2)
- 로그인 후 제품 보유 여부 토글
- 로그인 후 구매일시 / 구매처 / 구매가격 / 데칼 기록
- 제품 상세 팝업 (박스아트, 매뉴얼 링크 등)
- 박스아트 이미지 라이트박스

### 관리자 페이지 (`/admin`)
- ID / 비밀번호 로그인 (별도 세션)
- 제품 등록 / 수정 / 삭제 (소프트 딜리트)
- 박스아트 이미지 업로드 또는 URL로 등록 (썸네일 자동 생성)
- 카테고리 관리 (이름, 색상, 정렬 순서)

## 프로젝트 구조

```
src/main/kotlin/ia/antop/gunpla/
├── admin/        # 관리자 계정
├── category/     # 카테고리
├── common/       # 공통 설정, 예외 처리, 유틸리티
├── product/      # 제품
└── user/         # 사용자 계정, 보유 제품
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
