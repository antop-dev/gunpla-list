package ia.antop.gunpla.common.exception

import org.slf4j.LoggerFactory
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

// 전역 예외 핸들러 — 컨트롤러에서 던진 ApiException 과 처리되지 않은 예외를 JSON 응답으로 변환
@RestControllerAdvice
class GlobalExceptionHandler {
    private val log = LoggerFactory.getLogger(this::class.java)

    @ExceptionHandler(ApiException::class)
    fun handleApiException(e: ApiException): ResponseEntity<ErrorResponseDto> =
        ResponseEntity.status(e.status).body(ErrorResponseDto(e.message ?: "Error"))

    // 예상치 못한 예외는 로그에 스택 트레이스를 남기고 500 응답
    @ExceptionHandler(Exception::class)
    fun handleException(e: Exception): ResponseEntity<ErrorResponseDto> {
        log.error("Unhandled exception", e)
        return ResponseEntity.internalServerError().body(ErrorResponseDto("Internal server error"))
    }

    data class ErrorResponseDto(
        val message: String,
    )
}
