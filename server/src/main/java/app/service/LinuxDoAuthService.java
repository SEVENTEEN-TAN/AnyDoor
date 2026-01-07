package app.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.*;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

import java.util.Base64;
import java.util.Map;

@Service
public class LinuxDoAuthService {

    @Value("${linuxdo.client-id}")
    private String clientId;

    @Value("${linuxdo.client-secret}")
    private String clientSecret;

    @Value("${linuxdo.redirect-uri}")
    private String redirectUri;

    @Value("${linuxdo.auth-uri}")
    private String authUri;

    @Value("${linuxdo.token-uri}")
    private String tokenUri;

    @Value("${linuxdo.user-info-uri}")
    private String userInfoUri;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public String getAuthorizeUrl() {
        return authUri + "?client_id=" + clientId + "&response_type=code&redirect_uri=" + redirectUri;
    }

    public String accessToken(String code) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        String auth = clientId + ":" + clientSecret;
        String encodedAuth = Base64.getEncoder().encodeToString(auth.getBytes());
        headers.set("Authorization", "Basic " + encodedAuth);

        MultiValueMap<String, String> map = new LinkedMultiValueMap<>();
        map.add("grant_type", "authorization_code");
        map.add("code", code);
        map.add("redirect_uri", redirectUri);

        HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(map, headers);

        try {
            ResponseEntity<Map> response = restTemplate.postForEntity(tokenUri, request, Map.class);
            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                return (String) response.getBody().get("access_token");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return null;
    }

    public JsonNode getUserInfo(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + token);
        HttpEntity<String> entity = new HttpEntity<>(headers);

        try {
            ResponseEntity<String> response = restTemplate.exchange(userInfoUri, HttpMethod.GET, entity, String.class);
            if (response.getStatusCode() == HttpStatus.OK) {
                return objectMapper.readTree(response.getBody());
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return null;
    }
}
