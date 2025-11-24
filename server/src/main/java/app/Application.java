// 使用方法：运行 main 方法启动后端，默认端口 8080。
// 说明：MVP 内存存储，不依赖外部数据库；鉴权使用 Sa-Token。

package app;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan("app.mapper")
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
