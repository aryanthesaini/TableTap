package com.platform.auth;

import com.platform.common.config.AppProperties;
import com.platform.common.security.JwtClaims;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;

/** Issues signed access tokens. Swap for an external IdP by removing this and changing the JwtDecoder. */
@Component
public class TokenService {

    private final JwtEncoder encoder;
    private final AppProperties properties;
    private final Clock clock;

    public TokenService(JwtEncoder encoder, AppProperties properties, Clock clock) {
        this.encoder = encoder;
        this.properties = properties;
        this.clock = clock;
    }

    public IssuedToken issue(AppUser user) {
        Instant now = clock.instant();
        Instant expiresAt = now.plus(properties.security().jwtTtl());
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder()
                .issuer(JwtClaims.ISSUER)
                .subject(user.getId().toString())
                .issuedAt(now)
                .expiresAt(expiresAt)
                .claim(JwtClaims.ROLE, user.getRole().name())
                .claim(JwtClaims.EMAIL, user.getEmail())
                .claim(JwtClaims.NAME, user.getFullName());
        if (user.getRestaurantId() != null) {
            claims.claim(JwtClaims.RESTAURANT_ID, user.getRestaurantId().toString());
        }
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        String token = encoder.encode(JwtEncoderParameters.from(header, claims.build())).getTokenValue();
        return new IssuedToken(token, expiresAt);
    }

    public record IssuedToken(String value, Instant expiresAt) {}
}
