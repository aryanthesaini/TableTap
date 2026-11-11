package com.platform.common.security;

/** Claim names shared by the token issuer (auth module) and the token reader (security config). */
public final class JwtClaims {
    public static final String ROLE = "role";
    public static final String RESTAURANT_ID = "rid";
    public static final String EMAIL = "email";
    public static final String NAME = "name";
    public static final String ISSUER = "tabletap";

    private JwtClaims() {}
}
