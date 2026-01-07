package app.service;

import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Instant;
import java.util.Base64;
import java.util.Iterator;
import java.util.Map;
import java.util.Random;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class CaptchaService {

    private static final int WIDTH = 100;
    private static final int HEIGHT = 40;
    private static final int FONT_SIZE = 24;
    private static final long EXPIRATION_SECONDS = 300; // 5 minutes

    // Map<UUID, CaptchaItem>
    private final Map<String, CaptchaItem> captchaStore = new ConcurrentHashMap<>();
    private final Random random = new Random();

    private record CaptchaItem(String code, Instant expireAt) {
    }

    public record CaptchaResult(String uuid, String imageBase64) {
    }

    /**
     * Generate a new CAPTCHA
     */
    public CaptchaResult generate() {
        // Cleanup expired items occasionally (simple strategy: cleanup on every generation is too heavy, maybe probabalistic or just ignore for MVP/low volume)
        // For MVP, let's just cleanup expired ones if map gets too big or just every time for simplicity if volume is low.
        // Let's do a probabilistic cleanup or just simple cleanup.
        if (captchaStore.size() > 1000) {
            cleanupExpired();
        }

        String uuid = UUID.randomUUID().toString();
        String code = generateRandomCode(4);
        
        // Store
        captchaStore.put(uuid, new CaptchaItem(code, Instant.now().plusSeconds(EXPIRATION_SECONDS)));

        // Generate Image
        String imageBase64 = generateCaptchaImageBase64(code);

        return new CaptchaResult(uuid, imageBase64);
    }

    /**
     * Validate the CAPTCHA code
     */
    public boolean validate(String uuid, String inputCode) {
        if (uuid == null || inputCode == null) {
            return false;
        }

        CaptchaItem item = captchaStore.remove(uuid); // One-time use
        if (item == null) {
            return false;
        }

        if (Instant.now().isAfter(item.expireAt())) {
            return false;
        }

        return item.code().equalsIgnoreCase(inputCode);
    }

    private void cleanupExpired() {
        Iterator<Map.Entry<String, CaptchaItem>> it = captchaStore.entrySet().iterator();
        Instant now = Instant.now();
        while (it.hasNext()) {
            if (now.isAfter(it.next().getValue().expireAt())) {
                it.remove();
            }
        }
    }

    private String generateRandomCode(int length) {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed ambiguous chars 1, I, 0, O
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < length; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }
        return sb.toString();
    }

    private String generateCaptchaImageBase64(String code) {
        BufferedImage image = new BufferedImage(WIDTH, HEIGHT, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();

        // Background
        g.setColor(new Color(240, 240, 240));
        g.fillRect(0, 0, WIDTH, HEIGHT);

        // Border
        g.setColor(new Color(200, 200, 200));
        g.drawRect(0, 0, WIDTH - 1, HEIGHT - 1);

        // Random lines
        g.setStroke(new BasicStroke(1.0f));
        for (int i = 0; i < 5; i++) {
            g.setColor(new Color(random.nextInt(200), random.nextInt(200), random.nextInt(200)));
            g.drawLine(random.nextInt(WIDTH), random.nextInt(HEIGHT), random.nextInt(WIDTH), random.nextInt(HEIGHT));
        }

        // Code
        g.setFont(new Font("Arial", Font.BOLD, FONT_SIZE));
        int x = 10;
        for (char c : code.toCharArray()) {
            g.setColor(new Color(random.nextInt(100), random.nextInt(100), random.nextInt(100))); // Darker colors for text
            // Random y pos
            int y = 20 + random.nextInt(15);
            g.drawString(String.valueOf(c), x, y);
            x += 20;
        }

        g.dispose();

        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            ImageIO.write(image, "jpg", baos);
            return Base64.getEncoder().encodeToString(baos.toByteArray());
        } catch (IOException e) {
            throw new RuntimeException("Failed to generate captcha image", e);
        }
    }
}
