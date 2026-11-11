package com.platform.common.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springdoc.core.models.GroupedOpenApi;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    public static final String BEARER = "bearerAuth";

    @Bean
    public OpenAPI tableTapOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("TableTap API")
                        .version("v1")
                        .description("""
                                Multi-tenant restaurant QR ordering platform.

                                * `/api/v1/public/**` — customer storefront & checkout (no auth, scoped by table QR token)
                                * `/api/v1/restaurant/**` — restaurant dashboard (JWT, OWNER/STAFF, tenant from token)
                                * `/api/v1/admin/**` — platform admin (JWT, PLATFORM_ADMIN)
                                * `/api/v1/webhooks/**` — payment provider callbacks (signature-verified)

                                Obtain a token via `POST /api/v1/auth/login` (demo password: `demo1234`).
                                """))
                .components(new Components().addSecuritySchemes(BEARER,
                        new SecurityScheme().type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")));
    }

    @Bean
    public GroupedOpenApi publicApi() {
        return GroupedOpenApi.builder().group("1-public").pathsToMatch("/api/v1/public/**", "/api/v1/auth/**").build();
    }

    @Bean
    public GroupedOpenApi restaurantApi() {
        return GroupedOpenApi.builder().group("2-restaurant").pathsToMatch("/api/v1/restaurant/**").build();
    }

    @Bean
    public GroupedOpenApi adminApi() {
        return GroupedOpenApi.builder().group("3-admin").pathsToMatch("/api/v1/admin/**").build();
    }

    @Bean
    public GroupedOpenApi webhookApi() {
        return GroupedOpenApi.builder().group("4-webhooks").pathsToMatch("/api/v1/webhooks/**").build();
    }

    @Bean
    public GroupedOpenApi allApi() {
        return GroupedOpenApi.builder().group("0-all").pathsToMatch("/api/v1/**").build();
    }
}
