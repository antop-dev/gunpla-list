# CLAUDE.md

## Project Overview

이 프로젝트는 Kotlin + Spring Boot + Thymeleaf 기반의 웹 애플리케이션이다.

---

# Technology Stack

* Kotlin 2.x
* Spring Boot 4.x
* Spring Security
* Spring Data JPA
* Hibernate
* Thymeleaf
* SQLite
* Gradle Kotlin DSL

프론트엔드는 내가 잘 모르니 가장 많이 사용하는 기술을 사용한다.

---

# Mandatory Rules

## Language

* 모든 코드는 Kotlin으로 작성한다.
* Java 코드를 생성하지 않는다.
* Kotlin 스타일을 우선 적용한다.

### 사용

```kotlin
class ManualService(
    private val manualRepository: ManualRepository,
)
```

### 금지

```java
public class ManualService {
}
```

---

## Architecture

다음 계층 구조를 따른다.

```text
Controller
  ↓
Service
  ↓
Repository
```

### 금지

* Controller → Repository 직접 호출
* Template → Repository 접근
* Entity 직접 반환

---

# Package Structure

도메인 중심 구조를 사용한다.

```text
com.example.app

├── common
│   ├── config
│   ├── exception
│   └── cache
│
├── manual
│   ├── controller
│   ├── service
│   ├── repository
│   ├── entity
│   ├── dto
│   └── event
│
└── user
```

새 기능 추가 시 기존 패턴을 우선 따른다.

---

# Kotlin Convention

## 클래스 선언

```kotlin
@Service
class ManualService(
    private val manualRepository: ManualRepository,
)
```

field injection 사용 금지.

### 금지

```kotlin
@Autowired
lateinit var repository: ManualRepository
```

---

## Scope Function

과도한 Scope Function 사용 금지.

### 허용

```kotlin
return entity.apply {
    published = true
}
```

### 금지

```kotlin
foo?.let {
    bar?.also {
        baz?.run {
        }
    }
}
```

---

# Controller Convention

Controller는 요청/응답만 처리한다.

### 사용

```kotlin
@GetMapping("/{id}")
fun get(
    @PathVariable id: Long,
): ManualResponse = manualService.get(id) // 서비스를 호출
```

### 금지

```kotlin
@GetMapping("/{id}")
fun get(
    @PathVariable id: Long,
): ManualResponse {
    val entity = repository.findById(id) // Repository를 직접 호출하면 안된다
    // ...
}
```

---

# Service Convention

비즈니스 로직은 Service에 위치한다.

### 조회

```kotlin
@Transactional(readOnly = true)
fun get(id: Long): ManualResponse
```

### 수정

```kotlin
@Transactional
fun publish(id: Long)
```

---

# Entity Convention

JPA Entity는 데이터 저장 목적만 가진다.

Entity의 모든 속성은 가변 변수(`var`)로 만들어줘

### 사용

```kotlin
@Entity
class Manual(

    @Id
    @GeneratedValue
    val id: Long? = null,

    var title: String,

    var published: Boolean,
)
```

### 금지

* DTO 역할 수행
* 외부 API 호출
* Repository 주입

---

## JPA 연관관계

JPA의 `@ManyToOne`, `@OneToMany`, `@OneToOne` 등 연관관계를 표현하는 어노테이션을 사용하지 않는다.

조합이 필요한 각각 호출해서 DTO를 조합한다.

---

# DTO Convention

Entity를 Controller에 노출하지 않는다. 항상 클래스명 마지막에 `Dto`를 넣는다.

## Request

```kotlin
data class ManualCreateRequestDto(
    val title: String,
)
```

## Response

```kotlin
data class ManualResponseDto(
    val id: Long,
    val title: String,
)
```

---

# Repository Convention

Spring Data JPA 사용

### 우선순위

1. Query Method
2. JPQL
3. QueryDSL

---

# Event Convention

도메인 이벤트 사용

### 발행

```kotlin
eventPublisher.publishEvent(
    ManualPublishedEvent(
        manualId = manual.id!!,
    )
)
```

### 처리

```kotlin
@EventListener
fun handle(
    event: ManualPublishedEvent,
)
```

---

# Cache Convention

CacheManager는 Spring Cache 어노테이션 사용. `CacheManager`를 직접 사용하지 않는다.

### 사용

```kotlin
@Cacheable(
    cacheNames = [CacheName.MANUAL],
    key = "#manualId",
)
```

### 갱신

```kotlin
@CacheEvict(
    cacheNames = [CacheName.MANUAL],
    key = "#manualId",
)
```

# HTML Convention

시맨틱 태그 우선

```html
<header>
<nav>
<main>
<section>
<footer>
```

---

# Javascript Convention

* Vanilla JS 우선
* 신규 jQuery 사용 금지

### 사용

```javascript
document.querySelector(".button")
```

### 금지

```javascript
$(".button")
```

---

# Logging Convention

### 사용

```kotlin
log.info("manualId={}", manualId)
```

### 금지

```kotlin
println(manualId)
```

---

# Test Convention

테스트 코드는 만들지 않는다.

백엔드 소스가 수정되면 빌드 테스트만 한다.

개발자가 직접 테스트 한다.

---

# AI Instructions

코드 생성 전 반드시 수행

1. 기존 코드 구조 분석
2. 기존 네이밍 규칙 확인
3. 최소 변경으로 구현
4. 테스트 코드 작성
5. 불필요한 리팩토링 금지

응답 순서

1. 변경 대상 파일
2. 변경 이유
3. 영향 범위
4. 코드 작성

기존 코드가 있다면 기존 패턴을 최우선으로 따른다.

선택

1. 이 디렉터리 내에 파일을 접근/생성/수정/삭제할 때 물어보지 않는다.
2. 외부 사이트를 접근할 때 물어본다.
