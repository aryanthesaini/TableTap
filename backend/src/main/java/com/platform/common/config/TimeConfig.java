package com.platform.common.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.time.ZoneId;

@Configuration
public class TimeConfig {

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }

    /** Business time zone used for "today" boundaries in analytics. */
    @Bean
    public ZoneId businessZone(AppProperties properties) {
        return ZoneId.of(properties.timezone());
    }
}
