package app.config;

import cn.dev33.satoken.exception.NotLoginException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(NotLoginException.class)
    public ResponseEntity<?> handleNotLogin(NotLoginException e) {
        return ResponseEntity.status(401).body(Map.of(
                "error", "not_login",
                "message", e.getMessage()
        ));
    }
}

