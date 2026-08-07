package ai.antop.gunpla.common.controller

import ai.antop.gunpla.common.service.ImageToolService
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile

// 어드민 이미지 도구 API — /api/admin/image-tools (어드민 필터체인, ROLE_ADMIN 필요)
// 어드민 헤더의 "이미지 여백 제거" 팝업 전용 — 업로드/붙여넣기 이미지의 상하좌우 흰 여백을 잘라 JPEG 로 반환
@RestController
@RequestMapping("/api/admin/image-tools")
class ImageToolController(
    private val imageToolService: ImageToolService,
) {
    @PostMapping("/trim")
    fun trimUpload(
        @RequestParam("file") file: MultipartFile,
    ): ResponseEntity<ByteArray> =
        ResponseEntity.ok().contentType(MediaType.IMAGE_JPEG).body(imageToolService.trimUpload(file))
}
