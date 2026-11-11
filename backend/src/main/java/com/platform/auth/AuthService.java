package com.platform.auth;

import com.platform.auth.dto.DemoAccountResponse;
import com.platform.auth.dto.LoginRequest;
import com.platform.auth.dto.LoginResponse;
import com.platform.auth.dto.UserResponse;

import java.util.List;
import java.util.UUID;

public interface AuthService {

    LoginResponse login(LoginRequest request);

    UserResponse getUser(UUID userId);

    List<DemoAccountResponse> demoAccounts();
}
