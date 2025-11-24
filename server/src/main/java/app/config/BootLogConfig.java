package app.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

@Configuration
public class BootLogConfig {
    private static final Logger log = LoggerFactory.getLogger(BootLogConfig.class);

    @Bean
    CommandLineRunner printEffectiveDatasource(Environment env) {
        return args -> {
            String url1 = env.getProperty("spring.datasource.url");
            String url2 = env.getProperty("spring.datasource.druid.url");
            String envUrl = System.getenv("SPRING_DATASOURCE_URL");
            String cp = env.getProperty("spring.datasource.druid.connection-properties");
            log.info("Effective DS urls: spring.datasource.url={}, spring.datasource.druid.url={}, ENV(SPRING_DATASOURCE_URL)={} ", url1, url2, envUrl);
            if (cp != null) {
                log.info("Druid connection-properties={}", cp);
            }
        };
    }
}

