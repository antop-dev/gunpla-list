package ia.antop.gunpla.common.controller

import ia.antop.gunpla.common.config.AppProperties
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.MediaType
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController

@RestController
class SeoController(
    private val appProperties: AppProperties,
    @Value("\${server.servlet.context-path:}") private val contextPath: String,
) {
    private val baseUrl get() = appProperties.baseUrl.trimEnd('/') + contextPath

    @GetMapping("/robots.txt", produces = [MediaType.TEXT_PLAIN_VALUE])
    fun robots(): String =
        """
        User-agent: *
        Disallow: $contextPath/admin
        Disallow: $contextPath/admin/
        Disallow: $contextPath/api/admin/

        Sitemap: $baseUrl/sitemap.xml
        """.trimIndent()

    @GetMapping("/sitemap.xml", produces = [MediaType.APPLICATION_XML_VALUE])
    fun sitemap(): String =
        """
        <?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url>
                <loc>$baseUrl/</loc>
                <changefreq>daily</changefreq>
                <priority>1.0</priority>
            </url>
        </urlset>
        """.trimIndent()
}
