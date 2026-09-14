package ai.antop.gunpla.common.converter

import jakarta.persistence.AttributeConverter
import jakarta.persistence.Converter

// 여러 값을 컬럼 하나에 개행으로 합쳐 저장하는 TEXT 컬럼용 컨버터 (예: product.manual_url)
// 코드에서는 항상 List 로 다루고, DB 표현(개행 결합 문자열)은 이 변환만 알고 있게 한다
// 빈 목록은 null 로 저장하고, 읽을 때는 공백 줄을 걸러내므로 값이 하나뿐인 기존 데이터도 1건짜리 목록이 된다
@Converter
class NewlineSeparatedListConverter : AttributeConverter<List<String>, String> {
    override fun convertToDatabaseColumn(attribute: List<String>?): String? =
        attribute
            ?.map { it.trim() }
            ?.filter { it.isNotBlank() }
            ?.joinToString(SEPARATOR)
            ?.takeIf { it.isNotBlank() }

    override fun convertToEntityAttribute(dbData: String?): List<String> =
        dbData
            ?.lines()
            ?.map { it.trim() }
            ?.filter { it.isNotBlank() }
            ?: emptyList()

    companion object {
        private const val SEPARATOR = "\n"
    }
}
