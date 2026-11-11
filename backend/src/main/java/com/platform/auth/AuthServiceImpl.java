package com.platform.auth;

import com.platform.auth.dto.DemoAccountResponse;
import com.platform.auth.dto.LoginRequest;
import com.platform.auth.dto.LoginResponse;
import com.platform.auth.dto.UserResponse;
import com.platform.common.config.AppProperties;
import com.platform.common.error.ApiException;
import com.platform.common.error.NotFoundException;
import com.platform.common.security.UserRole;
import com.platform.restaurant.RestaurantService;
import com.platform.restaurant.RestaurantStatus;
import com.platform.restaurant.dto.RestaurantResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class AuthServiceImpl implements AuthService {

    /** Demo password for seeded accounts (see db/demo seed). Only exposed when app.demo.enabled=true. */
    static final String DEMO_PASSWORD = "demo1234";

    private final AppUserRepository userRepository;
    private final RestaurantService restaurantService;
    private final PasswordEncoder passwordEncoder;
    private final TokenService tokenService;
    private final AppProperties properties;
    private final Clock clock;

    public AuthServiceImpl(AppUserRepository userRepository, RestaurantService restaurantService,
                           PasswordEncoder passwordEncoder, TokenService tokenService,
                           AppProperties properties, Clock clock) {
        this.userRepository = userRepository;
        this.restaurantService = restaurantService;
        this.passwordEncoder = passwordEncoder;
        this.tokenService = tokenService;
        this.properties = properties;
        this.clock = clock;
    }

    @Override
    @Transactional
    public LoginResponse login(LoginRequest request) {
        AppUser user = userRepository.findByEmailIgnoreCase(request.email().trim())
                .filter(AppUser::isActive)
                .filter(u -> passwordEncoder.matches(request.password(), u.getPasswordHash()))
                .orElseThrow(() -> new BadCredentialsException("Incorrect email or password"));

        RestaurantResponse restaurant = null;
        if (user.getRestaurantId() != null) {
            restaurant = restaurantService.get(user.getRestaurantId());
            if (restaurant.status() == RestaurantStatus.SUSPENDED) {
                throw new ApiException(HttpStatus.FORBIDDEN, "RESTAURANT_SUSPENDED",
                        "This restaurant account has been suspended. Please contact platform support.");
            }
        }
        user.setLastLoginAt(clock.instant());
        TokenService.IssuedToken token = tokenService.issue(user);
        return new LoginResponse(token.value(), "Bearer", token.expiresAt(), toResponse(user, restaurant));
    }

    @Override
    public UserResponse getUser(UUID userId) {
        AppUser user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("User"));
        RestaurantResponse restaurant = user.getRestaurantId() == null ? null : restaurantService.get(user.getRestaurantId());
        return toResponse(user, restaurant);
    }

    @Override
    public List<DemoAccountResponse> demoAccounts() {
        if (!properties.demo().enabled()) {
            return List.of();
        }
        return userRepository.findAllByActiveTrueOrderByEmailAsc().stream()
                .map(u -> {
                    RestaurantResponse r = u.getRestaurantId() == null ? null : restaurantService.get(u.getRestaurantId());
                    return new DemoAccountResponse(u.getEmail(), DEMO_PASSWORD, u.getFullName(), u.getRole(),
                            r == null ? null : r.name(), r == null ? null : r.slug());
                })
                .sorted(Comparator.comparing((DemoAccountResponse a) -> a.role() == UserRole.PLATFORM_ADMIN)
                        .thenComparing(a -> a.restaurantName() == null ? "" : a.restaurantName())
                        .thenComparing(DemoAccountResponse::role))
                .toList();
    }

    private static UserResponse toResponse(AppUser user, RestaurantResponse restaurant) {
        return new UserResponse(user.getId(), user.getEmail(), user.getFullName(), user.getRole(), user.getRestaurantId(),
                restaurant == null ? null : restaurant.name(), restaurant == null ? null : restaurant.slug(),
                user.getLastLoginAt());
    }
}
