package ai.antop.gunpla.common.service

import ai.antop.gunpla.common.exception.BadRequestException
import ai.antop.gunpla.common.util.ImageUtils
import org.springframework.stereotype.Service
import org.springframework.web.multipart.MultipartFile
import javax.imageio.ImageIO

// 어드민 헤더 "이미지 여백 제거" 팝업 전용 — 업로드/붙여넣기 이미지의 상하좌우 흰 여백을 잘라 JPEG 로 반환
@Service
class ImageToolService {
    fun trimUpload(file: MultipartFile): ByteArray {
        val source = ImageIO.read(file.inputStream) ?: throw BadRequestException("이미지를 읽을 수 없습니다.")
        return ImageUtils.trimWhitespaceToJpegBytes(source)
    }
}
