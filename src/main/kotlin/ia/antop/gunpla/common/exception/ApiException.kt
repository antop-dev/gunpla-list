package ia.antop.gunpla.common.exception

import org.springframework.http.HttpStatus

// 모든 API 예외의 기반 클래스 — GlobalExceptionHandler 에서 status 를 그대로 HTTP 응답 코드로 사용
open class ApiException(
    val status: HttpStatus,
    message: String,
) : RuntimeException(message)

class NotFoundException(
    message: String,
) : ApiException(HttpStatus.NOT_FOUND, message)

class BadRequestException(
    message: String,
) : ApiException(HttpStatus.BAD_REQUEST, message)

class UnauthorizedException(
    message: String = "Unauthorized",
) : ApiException(HttpStatus.UNAUTHORIZED, message)
