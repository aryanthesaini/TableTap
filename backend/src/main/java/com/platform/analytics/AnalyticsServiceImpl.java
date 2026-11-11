package com.platform.analytics;

import com.platform.analytics.dto.AdminRestaurantResponse;
import com.platform.analytics.dto.PlatformOverviewResponse;
import com.platform.analytics.dto.RestaurantOverviewResponse;
import com.platform.restaurant.RestaurantService;
import com.platform.restaurant.RestaurantStatus;
import com.platform.restaurant.dto.RestaurantResponse;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class AnalyticsServiceImpl implements AnalyticsService {

    private final NamedParameterJdbcTemplate jdbc;
    private final RestaurantService restaurantService;
    private final Clock clock;
    private final ZoneId zone;

    public AnalyticsServiceImpl(NamedParameterJdbcTemplate jdbc, RestaurantService restaurantService,
                                Clock clock, ZoneId businessZone) {
        this.jdbc = jdbc;
        this.restaurantService = restaurantService;
        this.clock = clock;
        this.zone = businessZone;
    }

    @Override
    public RestaurantOverviewResponse restaurantOverview(UUID restaurantId) {
        RestaurantResponse restaurant = restaurantService.get(restaurantId);
        Instant now = clock.instant();
        LocalDate today = LocalDate.now(clock.withZone(zone));
        Instant startOfToday = today.atStartOfDay(zone).toInstant();
        Instant startOfYesterday = today.minusDays(1).atStartOfDay(zone).toInstant();
        Instant sameTimeYesterday = now.minus(Duration.ofDays(1));

        var p = params(restaurantId).addValue("start", ts(startOfToday)).addValue("now", ts(now))
                .addValue("yStart", ts(startOfYesterday)).addValue("yNow", ts(sameTimeYesterday))
                .addValue("weekStart", ts(today.minusDays(6).atStartOfDay(zone).toInstant()))
                .addValue("tz", zone.getId());

        Map<String, Object> t = jdbc.queryForMap("""
                select count(*) filter (where created_at >= :start)                               as orders,
                       coalesce(sum(total_amount) filter (where created_at >= :start), 0)         as revenue,
                       count(*) filter (where created_at >= :start and status = 'SERVED')         as served,
                       count(*) filter (where status = 'PENDING')                                 as pending,
                       count(*) filter (where created_at >= :yStart and created_at < :yNow)       as y_orders,
                       coalesce(sum(total_amount) filter (where created_at >= :yStart and created_at < :yNow), 0) as y_revenue
                from customer_order where restaurant_id = :rid and payment_status = 'CAPTURED'
                """, p);
        long orders = num(t.get("orders"));
        BigDecimal revenue = dec(t.get("revenue"));
        BigDecimal aov = orders == 0 ? BigDecimal.ZERO : revenue.divide(BigDecimal.valueOf(orders), 2, RoundingMode.HALF_UP);
        var todayStats = new RestaurantOverviewResponse.Today(orders, revenue, num(t.get("pending")), num(t.get("served")),
                aov, num(t.get("y_orders")), dec(t.get("y_revenue")));

        Map<Integer, RestaurantOverviewResponse.HourlyPoint> byHour = new HashMap<>();
        jdbc.query("""
                select extract(hour from created_at at time zone :tz)::int as h, count(*) as c, sum(total_amount) as r
                from customer_order
                where restaurant_id = :rid and payment_status = 'CAPTURED' and created_at >= :start
                group by 1
                """, p, rs -> {
            byHour.put(rs.getInt("h"), new RestaurantOverviewResponse.HourlyPoint(rs.getInt("h"), rs.getLong("c"), rs.getBigDecimal("r")));
        });
        List<RestaurantOverviewResponse.HourlyPoint> hourly = new ArrayList<>();
        // Lunch-to-close by default; extend earlier if the restaurant took orders before 10am.
        int firstHour = Math.min(10, byHour.keySet().stream().min(Integer::compare).orElse(10));
        for (int h = firstHour; h <= 23; h++) {
            hourly.add(byHour.getOrDefault(h, new RestaurantOverviewResponse.HourlyPoint(h, 0, BigDecimal.ZERO)));
        }

        Map<LocalDate, RestaurantOverviewResponse.DailyPoint> byDay = new HashMap<>();
        jdbc.query("""
                select (created_at at time zone :tz)::date as d, count(*) as c, sum(total_amount) as r
                from customer_order
                where restaurant_id = :rid and payment_status = 'CAPTURED' and created_at >= :weekStart
                group by 1
                """, p, rs -> {
            LocalDate d = rs.getDate("d").toLocalDate();
            byDay.put(d, new RestaurantOverviewResponse.DailyPoint(d, rs.getLong("c"), rs.getBigDecimal("r")));
        });
        List<RestaurantOverviewResponse.DailyPoint> days = new ArrayList<>();
        for (int i = 6; i >= 0; i--) {
            LocalDate d = today.minusDays(i);
            days.add(byDay.getOrDefault(d, new RestaurantOverviewResponse.DailyPoint(d, 0, BigDecimal.ZERO)));
        }

        List<RestaurantOverviewResponse.TopItem> topItems = jdbc.query("""
                select oi.item_name as name, sum(oi.quantity) as q, sum(oi.line_total) as r
                from order_item oi join customer_order o on o.id = oi.order_id
                where o.restaurant_id = :rid and o.payment_status = 'CAPTURED' and o.created_at >= :weekStart
                group by oi.item_name order by q desc, r desc limit 5
                """, p, (rs, i) -> new RestaurantOverviewResponse.TopItem(rs.getString("name"), rs.getLong("q"), rs.getBigDecimal("r")));

        return new RestaurantOverviewResponse(restaurant.currency(), todayStats, hourly, days, topItems);
    }

    @Override
    public PlatformOverviewResponse platformOverview() {
        LocalDate today = LocalDate.now(clock.withZone(zone));
        var p = new MapSqlParameterSource()
                .addValue("start", ts(today.atStartOfDay(zone).toInstant()))
                .addValue("weekStart", ts(today.minusDays(6).atStartOfDay(zone).toInstant()))
                .addValue("tz", zone.getId());
        Map<String, Object> t = jdbc.queryForMap("""
                select count(*) filter (where created_at >= :start) as orders_today,
                       coalesce(sum(total_amount) filter (where created_at >= :start), 0) as gmv_today,
                       count(*) as orders_7d, coalesce(sum(total_amount), 0) as gmv_7d
                from customer_order where payment_status = 'CAPTURED' and created_at >= :weekStart
                """, p);
        Map<LocalDate, PlatformOverviewResponse.RestaurantDailyPoint> byDay = new HashMap<>();
        jdbc.query("""
                select (created_at at time zone :tz)::date as d, count(*) as c, sum(total_amount) as r
                from customer_order where payment_status = 'CAPTURED' and created_at >= :weekStart group by 1
                """, p, rs -> {
            LocalDate d = rs.getDate("d").toLocalDate();
            byDay.put(d, new PlatformOverviewResponse.RestaurantDailyPoint(d, rs.getLong("c"), rs.getBigDecimal("r")));
        });
        List<PlatformOverviewResponse.RestaurantDailyPoint> days = new ArrayList<>();
        for (int i = 6; i >= 0; i--) {
            LocalDate d = today.minusDays(i);
            days.add(byDay.getOrDefault(d, new PlatformOverviewResponse.RestaurantDailyPoint(d, 0, BigDecimal.ZERO)));
        }
        List<RestaurantResponse> restaurants = restaurantService.listAll();
        long active = restaurants.stream().filter(r -> r.status() == RestaurantStatus.ACTIVE).count();
        return new PlatformOverviewResponse(restaurants.size(), active, restaurants.size() - active,
                num(t.get("orders_today")), dec(t.get("gmv_today")), num(t.get("orders_7d")), dec(t.get("gmv_7d")), days);
    }

    @Override
    public List<AdminRestaurantResponse> adminRestaurants() {
        return restaurantService.listAll().stream().map(r -> buildAdmin(r, false)).toList();
    }

    @Override
    public AdminRestaurantResponse adminRestaurant(UUID restaurantId) {
        return buildAdmin(restaurantService.get(restaurantId), true);
    }

    private AdminRestaurantResponse buildAdmin(RestaurantResponse r, boolean withMembers) {
        LocalDate today = LocalDate.now(clock.withZone(zone));
        var p = params(r.id())
                .addValue("start", ts(today.atStartOfDay(zone).toInstant()))
                .addValue("weekStart", ts(today.minusDays(6).atStartOfDay(zone).toInstant()));
        Map<String, Object> s = jdbc.queryForMap("""
                select count(*) filter (where created_at >= :start) as orders_today,
                       coalesce(sum(total_amount) filter (where created_at >= :start), 0) as revenue_today,
                       count(*) filter (where created_at >= :weekStart) as orders_7d,
                       coalesce(sum(total_amount) filter (where created_at >= :weekStart), 0) as revenue_7d,
                       count(*) as orders_all, coalesce(sum(total_amount), 0) as revenue_all,
                       count(*) filter (where status = 'PENDING') as pending,
                       max(created_at) as last_order_at,
                       (select count(*) from restaurant_table t where t.restaurant_id = :rid and t.active and t.deleted_at is null) as tables,
                       (select count(*) from menu_item m where m.restaurant_id = :rid and m.deleted_at is null) as items
                from customer_order where restaurant_id = :rid and payment_status = 'CAPTURED'
                """, p);
        Timestamp last = (Timestamp) s.get("last_order_at");
        var stats = new AdminRestaurantResponse.Stats(num(s.get("orders_today")), dec(s.get("revenue_today")),
                num(s.get("orders_7d")), dec(s.get("revenue_7d")), num(s.get("orders_all")), dec(s.get("revenue_all")),
                num(s.get("pending")), num(s.get("tables")), num(s.get("items")), last == null ? null : last.toInstant());

        List<Map<String, Object>> config = jdbc.queryForList(
                "select status, mode from payment_configuration where restaurant_id = :rid", p);
        String paymentStatus = config.isEmpty() ? "NOT_CONNECTED" : (String) config.get(0).get("status");
        String paymentMode = config.isEmpty() ? null : (String) config.get(0).get("mode");

        List<AdminRestaurantResponse.Member> members = withMembers ? jdbc.query("""
                select email, full_name, role, last_login_at from app_user where restaurant_id = :rid order by role, email
                """, p, (rs, i) -> new AdminRestaurantResponse.Member(rs.getString("email"), rs.getString("full_name"),
                rs.getString("role"), rs.getTimestamp("last_login_at") == null ? null : rs.getTimestamp("last_login_at").toInstant()))
                : null;
        return new AdminRestaurantResponse(r, stats, paymentStatus, paymentMode, members);
    }

    private static MapSqlParameterSource params(UUID restaurantId) {
        return new MapSqlParameterSource("rid", restaurantId);
    }

    private static Timestamp ts(Instant instant) {
        return Timestamp.from(instant);
    }

    private static long num(Object o) {
        return o == null ? 0 : ((Number) o).longValue();
    }

    private static BigDecimal dec(Object o) {
        return o == null ? BigDecimal.ZERO : new BigDecimal(o.toString()).setScale(2, RoundingMode.HALF_UP);
    }
}
