package ai.antop.gunpla.common.service

import ai.antop.gunpla.common.util.ImageUtils
import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile

// 어드민 헤더 "이미지 여백 제거" 팝업 전용 — 업로드/붙여넣기 이미지의 상하좌우 흰 여백을 잘라 JPEG 로 반환
@Service
class ImageToolService {
    fun trimUpload(file: MultipartFile): ByteArray {
        // 포맷/크기 검증 포함 — 거대한 이미지로 OOM 이 나지 않도록
        val source = ImageUtils.readImage(file.bytes).image
        return ImageUtils.trimWhitespaceToJpegBytes(source)
    }
}
