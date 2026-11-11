package com.platform;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.Map;

import static io.zonky.test.db.AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end against a real PostgreSQL (embedded) with Flyway schema + demo seed:
 * QR storefront → server-priced checkout → mock gateway → verified capture → order in dashboard → served,
 * plus tenant isolation and role checks.
 */
@SpringBootTest
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = ZONKY)
@ActiveProfiles({"demo", "test"})
class OrderingFlowIntegrationTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;

    private String login(String email) throws Exception {
        String body = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("email", email, "password", "demo1234"))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("accessToken").asText();
    }

    private ResultActions call(MockHttpServletRequestBuilder req, String token) throws Exception {
        return mvc.perform(req.header("Authorization", "Bearer " + token));
    }

    private JsonNode body(ResultActions actions) throws Exception {
        return json.readTree(actions.andReturn().getResponse().getContentAsString());
    }

    private String tableToken(String slug, String table) {
        return jdbc.queryForObject("""
                select t.qr_token from restaurant_table t join restaurant r on r.id = t.restaurant_id
                where r.slug = ? and t.name = ?""", String.class, slug, table);
    }

    @Test
    void customerPaysAndRestaurantServesOrder() throws Exception {
        String token = tableToken("saffron-table", "Table 3");

        // 1. Storefront for the scanned QR
        JsonNode storefront = body(mvc.perform(get("/api/v1/public/storefront/saffron-table/tables/" + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.restaurant.name").value("Saffron Table"))
                .andExpect(jsonPath("$.table.name").value("Table 3"))
                .andExpect(jsonPath("$.orderingEnabled").value(true)));
        JsonNode butterChicken = null;
        for (JsonNode c : storefront.get("categories")) {
            for (JsonNode i : c.get("items")) {
                if (i.get("name").asText().equals("Butter Chicken")) butterChicken = i;
            }
        }
        assertThat(butterChicken).isNotNull();

        // 2. Checkout — server prices the cart (480 × 2 + 5% GST = 1008.00)
        JsonNode checkout = body(mvc.perform(post("/api/v1/public/checkout").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("restaurantSlug", "saffron-table", "tableToken", token,
                                "items", new Object[]{Map.of("menuItemId", butterChicken.get("id").asText(), "quantity", 2)}))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.totalAmount").value(1008.00)));
        String checkoutId = checkout.get("checkoutId").asText();
        String providerOrderId = checkout.get("payment").get("providerOrderId").asText();
        assertThat(jdbc.queryForObject("select count(*) from customer_order where checkout_session_id = ?::uuid",
                Integer.class, checkoutId)).isZero();

        // 3. A forged confirmation is rejected
        mvc.perform(post("/api/v1/public/checkout/" + checkoutId + "/confirm").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("providerOrderId", providerOrderId,
                                "providerPaymentId", "pay_fake", "signature", "forged"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PAYMENT_VERIFICATION_FAILED"));

        // 4. Customer pays in the (mock) gateway, browser forwards the result
        JsonNode paid = body(mvc.perform(post("/api/v1/public/mock-gateway/orders/" + providerOrderId + "/pay")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"outcome\":\"SUCCESS\",\"method\":\"UPI\"}"))
                .andExpect(status().isOk()));
        JsonNode confirmed = body(mvc.perform(post("/api/v1/public/checkout/" + checkoutId + "/confirm")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("providerOrderId", providerOrderId,
                                "providerPaymentId", paid.get("providerPaymentId").asText(),
                                "signature", paid.get("signature").asText()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.paymentStatus").value("CAPTURED")));
        String orderId = confirmed.get("orderId").asText();
        int orderNumber = confirmed.get("orderNumber").asInt();

        mvc.perform(get("/api/v1/public/orders/" + orderId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.items[0].name").value("Butter Chicken"));

        // 5. Owner sees it as pending; payment is linked
        String owner = login("owner@saffrontable.in");
        call(get("/api/v1/restaurant/orders/" + orderId), owner)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orderNumber").value(orderNumber))
                .andExpect(jsonPath("$.tableName").value("Table 3"))
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.paymentStatus").value("CAPTURED"))
                .andExpect(jsonPath("$.items[0].unitPrice").value(480.00));
        assertThat(jdbc.queryForObject("select order_number from payment where order_id = ?::uuid", Integer.class, orderId))
                .isEqualTo(orderNumber);

        // 6. Another restaurant cannot see it
        String otherOwner = login("owner@coastalcurry.in");
        call(get("/api/v1/restaurant/orders/" + orderId), otherOwner).andExpect(status().isNotFound());
        call(post("/api/v1/restaurant/orders/" + orderId + "/serve"), otherOwner).andExpect(status().isNotFound());

        // 7. Staff marks it served
        String staff = login("staff@saffrontable.in");
        call(post("/api/v1/restaurant/orders/" + orderId + "/serve"), staff)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SERVED"));

        // 8. Webhook from the gateway arrives later — must not create a duplicate order
        Thread.sleep(800);
        assertThat(jdbc.queryForObject("select count(*) from customer_order where checkout_session_id = ?::uuid",
                Integer.class, checkoutId)).isEqualTo(1);
    }

    @Test
    void failedPaymentNeverCreatesOrder() throws Exception {
        String token = tableToken("wok-and-tandoor", "Table 2");
        String itemId = jdbc.queryForObject("""
                select m.id::text from menu_item m join restaurant r on r.id = m.restaurant_id
                where r.slug = 'wok-and-tandoor' and m.name = 'Chilli Chicken'""", String.class);
        JsonNode checkout = body(mvc.perform(post("/api/v1/public/checkout").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("restaurantSlug", "wok-and-tandoor", "tableToken", token,
                        "items", new Object[]{Map.of("menuItemId", itemId, "quantity", 1)})))).andExpect(status().isCreated()));
        String checkoutId = checkout.get("checkoutId").asText();
        mvc.perform(post("/api/v1/public/mock-gateway/orders/" + checkout.get("payment").get("providerOrderId").asText() + "/pay")
                .contentType(MediaType.APPLICATION_JSON).content("{\"outcome\":\"FAILURE\"}")).andExpect(status().isOk());

        mvc.perform(post("/api/v1/public/checkout/" + checkoutId + "/sync"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("FAILED"))
                .andExpect(jsonPath("$.paymentStatus").value("FAILED"))
                .andExpect(jsonPath("$.orderId").doesNotExist());
    }

    @Test
    void unavailableItemsCannotBeOrderedAndTokensAreTenantBound() throws Exception {
        String token = tableToken("saffron-table", "Table 1");
        String palakPaneer = jdbc.queryForObject("""
                select m.id::text from menu_item m join restaurant r on r.id = m.restaurant_id
                where r.slug = 'saffron-table' and m.name = 'Palak Paneer'""", String.class);
        String coastalItem = jdbc.queryForObject("""
                select m.id::text from menu_item m join restaurant r on r.id = m.restaurant_id
                where r.slug = 'coastal-curry-co' and m.name = 'Goan Prawn Curry'""", String.class);

        mvc.perform(post("/api/v1/public/checkout").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("restaurantSlug", "saffron-table", "tableToken", token,
                                "items", new Object[]{Map.of("menuItemId", palakPaneer, "quantity", 1)}))))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ITEM_UNAVAILABLE"));

        // Another restaurant's item through this restaurant's table
        mvc.perform(post("/api/v1/public/checkout").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("restaurantSlug", "saffron-table", "tableToken", token,
                                "items", new Object[]{Map.of("menuItemId", coastalItem, "quantity", 1)}))))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ITEM_NOT_FOUND"));

        // A valid token under the wrong restaurant slug
        mvc.perform(get("/api/v1/public/storefront/coastal-curry-co/tables/" + token)).andExpect(status().isNotFound());

        // Inactive table shows the menu but blocks ordering
        String inactive = tableToken("saffron-table", "Table 10");
        mvc.perform(get("/api/v1/public/storefront/saffron-table/tables/" + inactive))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.orderingEnabled").value(false));
    }

    @Test
    void rolesAndTenantBoundariesAreEnforced() throws Exception {
        String staff = login("staff@saffrontable.in");
        String owner = login("owner@saffrontable.in");
        String admin = login("admin@tabletap.dev");

        mvc.perform(get("/api/v1/restaurant/orders")).andExpect(status().isUnauthorized());
        call(get("/api/v1/admin/restaurants"), owner).andExpect(status().isForbidden());
        call(get("/api/v1/restaurant/orders"), admin).andExpect(status().isForbidden());
        call(get("/api/v1/restaurant/payments"), staff).andExpect(status().isForbidden());
        call(put("/api/v1/restaurant/profile").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"X\",\"brandColor\":\"#000000\",\"taxLabel\":\"GST\",\"taxRatePercent\":5}"), staff)
                .andExpect(status().isForbidden());

        // Owners only ever see their own menu
        JsonNode menu = body(call(get("/api/v1/restaurant/menu"), owner).andExpect(status().isOk()));
        assertThat(menu.toString()).contains("Butter Chicken").doesNotContain("Goan Prawn Curry");

        // A Coastal category id is invisible to Saffron's owner
        String coastalCategory = jdbc.queryForObject("""
                select c.id::text from menu_category c join restaurant r on r.id = c.restaurant_id
                where r.slug = 'coastal-curry-co' and c.name = 'Curries'""", String.class);
        call(put("/api/v1/restaurant/menu/categories/" + coastalCategory).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Hacked\"}"), owner).andExpect(status().isNotFound());

        // Admin sees every restaurant
        JsonNode restaurants = body(call(get("/api/v1/admin/restaurants"), admin).andExpect(status().isOk()));
        assertThat(restaurants).hasSize(3);
    }

    @Test
    void validationErrorsUseStandardShape() throws Exception {
        mvc.perform(post("/api/v1/public/checkout").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"restaurantSlug\":\"saffron-table\",\"tableToken\":\"x\",\"items\":[]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("items"));
    }
}
