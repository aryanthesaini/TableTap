package com.platform.menuai.provider;

import com.platform.menu.Dietary;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;

/**
 * Returns a fixed, realistic extraction (a South Indian tiffin menu) regardless of the uploaded
 * file, including a few deliberately uncertain fields so the review workflow can be demonstrated.
 */
@Component
@ConditionalOnProperty(name = "app.menu-ai.provider", havingValue = "mock", matchIfMissing = true)
public class MockMenuExtractionProvider implements MenuExtractionProvider {

    @Override
    public String name() {
        return "mock-extractor-v1";
    }

    @Override
    public ExtractionResult extract(ExtractionInput input) {
        return new ExtractionResult(name(), List.of(
                item("Tiffin", "Idli Sambar (2 pcs)", "Steamed rice cakes with sambar and coconut chutney", "90", Dietary.VEG, 0.98),
                item("Tiffin", "Medu Vada (2 pcs)", "Crisp lentil doughnuts", "100", Dietary.VEG, 0.97),
                item("Tiffin", "Masala Dosa", "Rice crêpe with spiced potato filling", "140", Dietary.VEG, 0.99),
                item("Tiffin", "Mysore Masala Dosa", "Dosa with fiery red chutney and potato", "160", Dietary.VEG, 0.95),
                uncertain("Tiffin", "Rava Onion Dosa", "Semolina dosa with onions", "170", Dietary.VEG, 0.71, "price"),
                item("Tiffin", "Ghee Roast Dosa", null, "180", Dietary.VEG, 0.93),
                uncertain("Tiffin", "Pongal", "Rice and moong dal with pepper and ghee", null, Dietary.VEG, 0.58, "price"),
                item("Meals", "South Indian Thali", "Rice, sambar, rasam, two poriyals, curd, papad and payasam", "280", Dietary.VEG, 0.96),
                uncertain("Meals", "Chettinad Chicken Meals", "Thali with Chettinad chicken curry", "340", null, 0.66, "dietary"),
                item("Meals", "Curd Rice", "Tempered with mustard and curry leaves", "120", Dietary.VEG, 0.97),
                uncertain("Meals", "Bisi Bele Bath", null, "150", Dietary.VEG, 0.62, "name", "description"),
                item("Sides", "Extra Sambar", null, "40", Dietary.VEG, 0.94),
                uncertain("Sides", "Egg Kothu Parotta", "Shredded parotta tossed with egg and salna", "190", Dietary.EGG, 0.74, "category"),
                item("Beverages", "Filter Coffee", "Traditional decoction coffee", "60", Dietary.VEG, 0.99),
                item("Beverages", "Masala Tea", null, "50", Dietary.VEG, 0.98),
                uncertain("Beverages", "Badam Milk", "Hot or cold", "8O", Dietary.VEG, 0.52, "price"),
                item("Desserts", "Kesari Bath", "Semolina pudding with saffron and ghee", "90", Dietary.VEG, 0.92),
                item("Desserts", "Mysore Pak", "Gram flour fudge (2 pcs)", "110", Dietary.VEG, 0.9)
        ));
    }

    private static ExtractedItem item(String category, String name, String description, String price, Dietary dietary,
                                      double confidence) {
        return new ExtractedItem(category, name, description, new BigDecimal(price), dietary, confidence, List.of());
    }

    /** A price like "8O" (letter O) is an OCR misread: we surface no price and flag it. */
    private static ExtractedItem uncertain(String category, String name, String description, String price,
                                           Dietary dietary, double confidence, String... fields) {
        BigDecimal parsed = price != null && price.matches("\\d+(\\.\\d{1,2})?") ? new BigDecimal(price) : null;
        return new ExtractedItem(category, name, description, parsed, dietary, confidence, List.of(fields));
    }
}
