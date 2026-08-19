package ai.antop.gunpla

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.ConfigurationPropertiesScan
import org.springframework.boot.runApplication
import org.springframework.cloud.openfeign.EnableFeignClients
import org.springframework.scheduling.annotation.EnableScheduling

@SpringBootApplication
@ConfigurationPropertiesScan
@EnableFeignClients
@EnableScheduling
class GunplaListApplication

fun main(args: Array<String>) {
    runApplication<GunplaListApplication>(*args)
}
