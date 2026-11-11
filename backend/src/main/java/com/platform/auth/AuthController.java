package com.platform.auth;

import com.platform.auth.dto.DemoAccountResponse;
import com.platform.auth.dto.LoginRequest;
import com.platform.auth.dto.LoginResponse;
import com.platform.auth.dto.UserResponse;
import com.platform.common.config.OpenApiConfig;
import com.platform.common.security.CurrentUserProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "Authentication")
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;
    private final CurrentUserProvider currentUser;

    public AuthController(AuthService authService, CurrentUserProvider currentUser) {
        this.authService = authService;
        this.currentUser = currentUser;
    }

    @Operation(summary = "Sign in with email and password", description = "Returns a bearer token. Demo password: demo1234")
    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @Operation(summary = "Current signed-in user")
    @SecurityRequirement(name = OpenApiConfig.BEARER)
    @GetMapping("/me")
    public UserResponse me() {
        return authService.getUser(currentUser.get().userId());
    }

    @Operation(summary = "Demo accounts for the login screen (empty unless demo mode is enabled)")
    @GetMapping("/demo-accounts")
    public List<DemoAccountResponse> demoAccounts() {
        return authService.demoAccounts();
    }
}
