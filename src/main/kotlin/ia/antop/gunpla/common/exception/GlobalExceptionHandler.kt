package ia.antop.gunpla.common.exception

import org.slf4j.LoggerFactory
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestControllerAdvice
class GlobalExceptionHandler {
    private val log = LoggerFactory.getLogger(this::class.java)

    @ExceptionHandler(ApiException::class)
    fun handleApiException(e: ApiException): ResponseEntity<ErrorResponseDto> =
        ResponseEntity.status(e.status).body(ErrorResponseDto(e.message ?: "Error"))

    @ExceptionHandler(Exception::class)
    fun handleException(e: Exception): ResponseEntity<ErrorResponseDto> {
        log.error("Unhandled exception", e)
        return ResponseEntity.internalServerError().body(ErrorResponseDto("Internal server error"))
    }

    data class ErrorResponseDto(
        val message: String,
    )
}
