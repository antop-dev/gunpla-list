package ia.antop.gunpla.common.config

import com.github.cage.Cage
import com.github.cage.GCage
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class CageConfig {
    // GCage: Gimpy 스타일 렌더러 사용. 기본 포맷 jpeg, 이미지 200×70px
    // 글자 흔들림·회전 효과가 포함되어 OCR 기반 자동 입력을 방해함
    @Bean
    fun cage(): Cage = GCage()
}
