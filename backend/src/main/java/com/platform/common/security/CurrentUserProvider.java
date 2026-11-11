package com.platform.common.security;

import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
public class CurrentUserProvider {

    public CurrentUser get() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Jwt jwt)) {
            throw new AuthenticationCredentialsNotFoundException("Not authenticated");
        }
        String rid = jwt.getClaimAsString(JwtClaims.RESTAURANT_ID);
        return new CurrentUser(
                UUID.fromString(jwt.getSubject()),
                rid == null ? null : UUID.fromString(rid),
                UserRole.valueOf(jwt.getClaimAsString(JwtClaims.ROLE)),
                jwt.getClaimAsString(JwtClaims.EMAIL),
                jwt.getClaimAsString(JwtClaims.NAME));
    }

    public UUID restaurantId() {
        return get().requireRestaurantId();
    }
}
