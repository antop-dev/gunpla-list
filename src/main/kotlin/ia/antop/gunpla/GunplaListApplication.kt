package ia.antop.gunpla

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.ConfigurationPropertiesScan
import org.springframework.boot.runApplication

@SpringBootApplication
@ConfigurationPropertiesScan
class GunplaListApplication

fun main(args: Array<String>) {
    runApplication<GunplaListApplication>(*args)
}
