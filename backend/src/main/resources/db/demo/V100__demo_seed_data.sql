-- =====================================================================
-- Demo seed data (only loaded with the `demo` Spring profile).
-- Deterministic: fixed IDs/tokens and a seeded random generator, so every
-- fresh database looks the same. Order history is generated relative to the
-- time the migration runs (last 7 days, including "today").
-- Password for every demo user: demo1234
-- =====================================================================

-- ---------------------------------------------------------------------
-- Restaurants
-- ---------------------------------------------------------------------
INSERT INTO restaurant (id, slug, name, description, cuisine, logo_url, brand_color, address_line, city, state,
                        postal_code, phone, email, status, accepting_orders, currency, tax_label, tax_rate_percent)
VALUES
    ('a1000000-0000-4000-8000-000000000001', 'saffron-table', 'Saffron Table',
     'Slow-cooked North Indian classics, tandoor grills and breads baked to order.',
     'North Indian · Mughlai', '/images/logos/saffron-table.svg', '#B45309',
     'N-12, Outer Circle, Connaught Place', 'New Delhi', 'Delhi', '110001', '+91 98100 24680',
     'hello@saffrontable.in', 'ACTIVE', true, 'INR', 'GST', 5.00),
    ('a1000000-0000-4000-8000-000000000002', 'coastal-curry-co', 'Coastal Curry Co.',
     'Konkan and Malabar coast seafood — fresh catch, coconut, kokum and curry leaf.',
     'Coastal · Seafood', '/images/logos/coastal-curry-co.svg', '#0F766E',
     '14 Chapel Road, Bandra West', 'Mumbai', 'Maharashtra', '400050', '+91 98200 13579',
     'table@coastalcurry.in', 'ACTIVE', true, 'INR', 'GST', 5.00),
    ('a1000000-0000-4000-8000-000000000003', 'woodpecker-cafe', 'The Woodpecker Cafe',
     'Seoul-inspired noodles, wood-fired pizza and specialty coffee — comfort food at its best.',
     'Korean Fusion · Café', '/images/logos/woodpecker-cafe.svg', '#2F5016',
     '12 Church Street, MG Road', 'Bengaluru', 'Karnataka', '560001', '+91 98450 77889',
     'hello@woodpeckercafe.in', 'ACTIVE', true, 'INR', 'GST', 5.00);

-- ---------------------------------------------------------------------
-- Users (password: demo1234)
-- ---------------------------------------------------------------------
INSERT INTO app_user (restaurant_id, email, password_hash, full_name, role) VALUES
    (NULL, 'admin@tabletap.dev', '$2b$10$0cZz6VZvOqhbFrjeLKpZYeT6rl2kdp/GBs3XO34vZDgE.z4G2c1XS', 'Platform Admin', 'PLATFORM_ADMIN'),
    ('a1000000-0000-4000-8000-000000000001', 'owner@saffrontable.in', '$2b$10$0cZz6VZvOqhbFrjeLKpZYeT6rl2kdp/GBs3XO34vZDgE.z4G2c1XS', 'Rohan Malhotra', 'OWNER'),
    ('a1000000-0000-4000-8000-000000000001', 'staff@saffrontable.in', '$2b$10$0cZz6VZvOqhbFrjeLKpZYeT6rl2kdp/GBs3XO34vZDgE.z4G2c1XS', 'Priya Sharma', 'STAFF'),
    ('a1000000-0000-4000-8000-000000000002', 'owner@coastalcurry.in', '$2b$10$0cZz6VZvOqhbFrjeLKpZYeT6rl2kdp/GBs3XO34vZDgE.z4G2c1XS', 'Anita D''Souza', 'OWNER'),
    ('a1000000-0000-4000-8000-000000000002', 'staff@coastalcurry.in', '$2b$10$0cZz6VZvOqhbFrjeLKpZYeT6rl2kdp/GBs3XO34vZDgE.z4G2c1XS', 'Joel Fernandes', 'STAFF'),
    ('a1000000-0000-4000-8000-000000000003', 'owner@woodpeckercafe.in', '$2b$10$0cZz6VZvOqhbFrjeLKpZYeT6rl2kdp/GBs3XO34vZDgE.z4G2c1XS', 'Simran Kaur', 'OWNER'),
    ('a1000000-0000-4000-8000-000000000003', 'staff@woodpeckercafe.in', '$2b$10$0cZz6VZvOqhbFrjeLKpZYeT6rl2kdp/GBs3XO34vZDgE.z4G2c1XS', 'Himani Agarwal', 'STAFF');

-- ---------------------------------------------------------------------
-- Payment configuration (mock Razorpay test keys)
-- ---------------------------------------------------------------------
INSERT INTO payment_configuration (restaurant_id, provider, mode, status, key_id, key_secret, webhook_secret, connected_at) VALUES
    ('a1000000-0000-4000-8000-000000000001', 'RAZORPAY', 'TEST', 'ACTIVE', 'rzp_test_SaffronT4bl3', 'sk_demo_saffron_9f2a41c7', 'whsec_demo_saffron', now() - interval '60 days'),
    ('a1000000-0000-4000-8000-000000000002', 'RAZORPAY', 'TEST', 'ACTIVE', 'rzp_test_CoastalCurry', 'sk_demo_coastal_3b7e9d10', 'whsec_demo_coastal', now() - interval '45 days'),
    ('a1000000-0000-4000-8000-000000000003', 'RAZORPAY', 'TEST', 'ACTIVE', 'rzp_test_Woodpecker11', 'sk_demo_wpk_7a3c91d4', 'whsec_demo_wpk', now() - interval '20 days');

-- ---------------------------------------------------------------------
-- Tables (QR tokens are deterministic for the demo; new tables get random tokens)
-- ---------------------------------------------------------------------
INSERT INTO restaurant_table (restaurant_id, name, seats, qr_token, sort_order)
SELECT r.id, t.name, t.seats, substr(md5(r.slug || ':' || t.name), 1, 12), t.ord
FROM restaurant r
JOIN LATERAL (
    SELECT * FROM (VALUES
        ('saffron-table', 'Table 1', 2, 1), ('saffron-table', 'Table 2', 2, 2), ('saffron-table', 'Table 3', 4, 3),
        ('saffron-table', 'Table 4', 4, 4), ('saffron-table', 'Table 5', 4, 5), ('saffron-table', 'Table 6', 6, 6),
        ('saffron-table', 'Table 7', 6, 7), ('saffron-table', 'Table 8', 8, 8), ('saffron-table', 'Table 9', 4, 9),
        ('saffron-table', 'Table 10', 2, 10),
        ('coastal-curry-co', 'Table 1', 2, 1), ('coastal-curry-co', 'Table 2', 4, 2), ('coastal-curry-co', 'Table 3', 4, 3),
        ('coastal-curry-co', 'Table 4', 4, 4), ('coastal-curry-co', 'Table 5', 6, 5), ('coastal-curry-co', 'Table 6', 6, 6),
        ('coastal-curry-co', 'Table 7', 2, 7), ('coastal-curry-co', 'Table 8', 4, 8), ('coastal-curry-co', 'Patio 1', 4, 9),
        ('coastal-curry-co', 'Patio 2', 4, 10),
        ('woodpecker-cafe', 'Table 1', 2, 1), ('woodpecker-cafe', 'Table 2', 2, 2), ('woodpecker-cafe', 'Table 3', 4, 3),
        ('woodpecker-cafe', 'Table 4', 4, 4), ('woodpecker-cafe', 'Table 5', 4, 5), ('woodpecker-cafe', 'Table 6', 4, 6),
        ('woodpecker-cafe', 'Table 7', 6, 7), ('woodpecker-cafe', 'Table 8', 6, 8), ('woodpecker-cafe', 'Counter 1', 1, 9),
        ('woodpecker-cafe', 'Counter 2', 1, 10)
    ) AS v(slug, name, seats, ord)
    WHERE v.slug = r.slug
) t ON true;

-- Table 10 at Saffron Table is kept inactive to demonstrate deactivation.
UPDATE restaurant_table SET active = false
WHERE restaurant_id = 'a1000000-0000-4000-8000-000000000001' AND name = 'Table 10';

-- ---------------------------------------------------------------------
-- Menu categories
-- ---------------------------------------------------------------------
INSERT INTO menu_category (restaurant_id, name, description, sort_order)
SELECT r.id, c.name, c.description, c.ord
FROM restaurant r
JOIN LATERAL (
    SELECT * FROM (VALUES
        ('saffron-table', 'Starters', 'From the tandoor and the tawa', 1),
        ('saffron-table', 'Main Course', 'Slow-cooked curries', 2),
        ('saffron-table', 'Breads', 'Baked fresh in the clay oven', 3),
        ('saffron-table', 'Rice and Biryani', 'Dum-cooked, sealed with dough', 4),
        ('saffron-table', 'Beverages', NULL, 5),
        ('saffron-table', 'Desserts', NULL, 6),
        ('coastal-curry-co', 'Starters', 'Rava-crusted and fried to order', 1),
        ('coastal-curry-co', 'Curries', 'Coconut, kokum and curry leaf', 2),
        ('coastal-curry-co', 'Breads', NULL, 3),
        ('coastal-curry-co', 'Rice and Biryani', NULL, 4),
        ('coastal-curry-co', 'Beverages', NULL, 5),
        ('coastal-curry-co', 'Desserts', NULL, 6),
        ('woodpecker-cafe', 'Chef''s Specials', 'Ramyun bowls made fresh to order', 1),
        ('woodpecker-cafe', 'Korean Specials', NULL, 2),
        ('woodpecker-cafe', 'Small Plates', NULL, 3),
        ('woodpecker-cafe', 'Fries & Loaded Fries', NULL, 4),
        ('woodpecker-cafe', 'Nachos', NULL, 5),
        ('woodpecker-cafe', 'Pizza', NULL, 6),
        ('woodpecker-cafe', 'Garlic Bread & Pasta', NULL, 7),
        ('woodpecker-cafe', 'Sushi', NULL, 8),
        ('woodpecker-cafe', 'Burgers & Nuggets', NULL, 9),
        ('woodpecker-cafe', 'Hot Beverages', NULL, 10),
        ('woodpecker-cafe', 'Cold Beverages', NULL, 11),
        ('woodpecker-cafe', 'Desserts', NULL, 12)
    ) AS v(slug, name, description, ord)
    WHERE v.slug = r.slug
) c ON true;

-- ---------------------------------------------------------------------
-- Menu items
-- ---------------------------------------------------------------------
INSERT INTO menu_item (restaurant_id, category_id, name, description, price, image_url, available, dietary, featured, sort_order)
SELECT r.id, c.id, i.name, i.description, i.price, i.image, i.available, i.dietary, i.featured, i.ord
FROM (VALUES
    -- Saffron Table -------------------------------------------------------
    ('saffron-table', 'Starters', 'Tandoori Chicken', 'Half chicken marinated overnight in yoghurt, Kashmiri chilli and garam masala.', 420, '/images/menu/tandoori-chicken.jpg', true, 'NON_VEG', true, 1),
    ('saffron-table', 'Starters', 'Paneer Tikka', 'Charred cottage cheese, peppers and onion with mint chutney.', 340, NULL, true, 'VEG', true, 2),
    ('saffron-table', 'Starters', 'Mutton Seekh Kebab', 'Minced mutton with ginger, green chilli and fresh coriander, grilled on skewers.', 440, '/images/menu/seekh-kebab.jpg', true, 'NON_VEG', false, 3),
    ('saffron-table', 'Starters', 'Amritsari Fish', 'Gram-flour battered river sole with ajwain and lemon.', 460, '/images/menu/masala-fish.jpg', true, 'NON_VEG', false, 4),
    ('saffron-table', 'Starters', 'Hara Bhara Kebab', 'Spinach, green peas and potato patties with cashew.', 280, NULL, true, 'VEG', false, 5),
    ('saffron-table', 'Starters', 'Dahi Ke Kebab', 'Hung curd kebabs, crisp outside and creamy inside.', 300, NULL, true, 'VEG', false, 6),
    ('saffron-table', 'Main Course', 'Butter Chicken', 'Tandoori chicken simmered in a velvety tomato, butter and fenugreek gravy.', 480, '/images/menu/butter-chicken.jpg', true, 'NON_VEG', true, 1),
    ('saffron-table', 'Main Course', 'Dal Makhani', 'Black lentils slow-cooked overnight with butter and cream.', 360, '/images/menu/dal-fry.jpg', true, 'VEG', true, 2),
    ('saffron-table', 'Main Course', 'Matar Paneer', 'Cottage cheese and green peas in an onion-tomato masala.', 340, '/images/menu/matar-paneer.jpg', true, 'VEG', false, 3),
    ('saffron-table', 'Main Course', 'Mutton Rogan Josh', 'Kashmiri-style lamb curry with whole spices and ratan jot.', 540, '/images/menu/rogan-josh.jpg', true, 'NON_VEG', false, 4),
    ('saffron-table', 'Main Course', 'Kadai Chicken', 'Chicken tossed with bell peppers and freshly pounded kadai masala.', 460, '/images/menu/chicken-handi.jpg', true, 'NON_VEG', false, 5),
    ('saffron-table', 'Main Course', 'Baingan Bharta', 'Fire-roasted aubergine mashed with onion, tomato and green chilli.', 300, '/images/menu/baingan-bharta.jpg', true, 'VEG', false, 6),
    ('saffron-table', 'Main Course', 'Rajma Masala', 'Red kidney beans in a slow-cooked Punjabi gravy.', 280, '/images/menu/rajma.jpg', true, 'VEG', false, 7),
    ('saffron-table', 'Main Course', 'Palak Paneer', 'Cottage cheese in a smooth spinach gravy with garlic tempering.', 340, NULL, false, 'VEG', false, 8),
    ('saffron-table', 'Breads', 'Butter Naan', 'Leavened bread from the tandoor, brushed with butter.', 80, '/images/menu/flatbread.jpg', true, 'VEG', false, 1),
    ('saffron-table', 'Breads', 'Garlic Naan', 'Naan topped with chopped garlic and coriander.', 100, NULL, true, 'VEG', false, 2),
    ('saffron-table', 'Breads', 'Tandoori Roti', 'Whole wheat bread from the clay oven.', 45, NULL, true, 'VEG', false, 3),
    ('saffron-table', 'Breads', 'Laccha Paratha', 'Flaky, layered whole wheat paratha.', 90, NULL, true, 'VEG', false, 4),
    ('saffron-table', 'Breads', 'Amritsari Kulcha', 'Stuffed with spiced potato and onion, served with chole.', 160, NULL, true, 'VEG', false, 5),
    ('saffron-table', 'Rice and Biryani', 'Lamb Dum Biryani', 'Aged basmati and tender lamb, sealed and slow-cooked with saffron.', 560, '/images/menu/lamb-biryani.jpg', true, 'NON_VEG', true, 1),
    ('saffron-table', 'Rice and Biryani', 'Chicken Dum Biryani', 'Hyderabadi-style biryani with fried onions and mint. Served with raita.', 460, '/images/menu/chicken-biryani.jpg', true, 'NON_VEG', false, 2),
    ('saffron-table', 'Rice and Biryani', 'Subz Pulao', 'Basmati rice with seasonal vegetables and whole spices.', 280, NULL, true, 'VEG', false, 3),
    ('saffron-table', 'Rice and Biryani', 'Jeera Rice', 'Basmati tempered with cumin and ghee.', 200, '/images/menu/steamed-rice.jpg', true, 'VEG', false, 4),
    ('saffron-table', 'Beverages', 'Mango Lassi', 'Alphonso mango blended with thick yoghurt.', 160, '/images/menu/mango-lassi.jpg', true, 'VEG', false, 1),
    ('saffron-table', 'Beverages', 'Sweet Lassi', 'Chilled yoghurt drink topped with malai.', 130, NULL, true, 'VEG', false, 2),
    ('saffron-table', 'Beverages', 'Masala Chaas', 'Spiced buttermilk with roasted cumin and mint.', 90, NULL, true, 'VEG', false, 3),
    ('saffron-table', 'Beverages', 'Fresh Lime Soda', 'Sweet, salted or mixed.', 120, NULL, true, 'VEG', false, 4),
    ('saffron-table', 'Beverages', 'Masala Chai', 'Assam tea brewed with ginger and cardamom.', 80, NULL, true, 'VEG', false, 5),
    ('saffron-table', 'Desserts', 'Gulab Jamun', 'Two warm milk dumplings in rose-cardamom syrup.', 150, NULL, true, 'VEG', false, 1),
    ('saffron-table', 'Desserts', 'Rasmalai', 'Soft chhena discs in saffron-pistachio milk.', 180, NULL, true, 'VEG', false, 2),
    ('saffron-table', 'Desserts', 'Mango Phirni', 'Ground rice pudding set with mango, served chilled.', 170, '/images/menu/mango-custard.jpg', true, 'VEG', false, 3),
    ('saffron-table', 'Desserts', 'Gajar Halwa', 'Slow-cooked carrot halwa with khoya. Seasonal.', 190, NULL, false, 'VEG', false, 4),
    -- Coastal Curry Co. ----------------------------------------------------
    ('coastal-curry-co', 'Starters', 'Prawns Koliwada', 'Crisp-fried prawns in a spiced Koli-style batter.', 440, '/images/menu/chilli-prawns.jpg', true, 'NON_VEG', true, 1),
    ('coastal-curry-co', 'Starters', 'Bombil Fry', 'Bombay duck, rava-crusted and pan-fried.', 360, '/images/menu/fish-fry.jpg', true, 'NON_VEG', false, 2),
    ('coastal-curry-co', 'Starters', 'Surmai Rava Fry', 'Kingfish steak in a semolina crust with recheado masala.', 520, '/images/menu/masala-fish.jpg', true, 'NON_VEG', true, 3),
    ('coastal-curry-co', 'Starters', 'Chicken Sukka', 'Mangalorean dry chicken with roasted coconut and byadgi chilli.', 380, NULL, true, 'NON_VEG', false, 4),
    ('coastal-curry-co', 'Starters', 'Mushroom Pepper Fry', 'Button mushrooms tossed with black pepper and curry leaves.', 290, NULL, true, 'VEG', false, 5),
    ('coastal-curry-co', 'Starters', 'Kurkuri Bhindi', 'Crisp okra with chaat masala.', 250, NULL, true, 'VEG', false, 6),
    ('coastal-curry-co', 'Curries', 'Goan Prawn Curry', 'Prawns in a tangy coconut and kokum curry.', 540, '/images/menu/prawn-curry.jpg', true, 'NON_VEG', true, 1),
    ('coastal-curry-co', 'Curries', 'Malvani Fish Curry', 'Pomfret in a fiery Malvani masala with coconut milk.', 520, NULL, true, 'NON_VEG', false, 2),
    ('coastal-curry-co', 'Curries', 'Chicken Xacuti', 'Goan chicken curry with poppy seed and roasted coconut.', 460, '/images/menu/chicken-handi.jpg', true, 'NON_VEG', false, 3),
    ('coastal-curry-co', 'Curries', 'Mangalorean Ghee Roast', 'Chicken roasted in ghee with a tangy red chilli paste.', 480, NULL, true, 'NON_VEG', false, 4),
    ('coastal-curry-co', 'Curries', 'Kerala Egg Roast', 'Boiled eggs in a slow-roasted onion masala.', 290, NULL, true, 'EGG', false, 5),
    ('coastal-curry-co', 'Curries', 'Vegetable Stew', 'Mild coconut milk stew with vegetables, best with appam.', 320, NULL, true, 'VEG', false, 6),
    ('coastal-curry-co', 'Curries', 'Crab Masala', 'Mud crab in a robust Malvani masala. Market availability.', 780, NULL, false, 'NON_VEG', false, 7),
    ('coastal-curry-co', 'Breads', 'Malabar Parotta', 'Flaky layered flatbread.', 70, '/images/menu/flatbread.jpg', true, 'VEG', false, 1),
    ('coastal-curry-co', 'Breads', 'Neer Dosa (3 pcs)', 'Delicate rice crêpes.', 120, NULL, true, 'VEG', false, 2),
    ('coastal-curry-co', 'Breads', 'Appam (2 pcs)', 'Lacy fermented rice pancakes.', 130, NULL, true, 'VEG', false, 3),
    ('coastal-curry-co', 'Breads', 'Chapati', 'Soft whole wheat flatbread.', 40, NULL, true, 'VEG', false, 4),
    ('coastal-curry-co', 'Rice and Biryani', 'Thalassery Chicken Biryani', 'Short-grain kaima rice, chicken and fried onions, Malabar style.', 440, '/images/menu/chicken-biryani.jpg', true, 'NON_VEG', true, 1),
    ('coastal-curry-co', 'Rice and Biryani', 'Prawn Pulao', 'Konkani prawn pulao with coconut milk.', 480, '/images/menu/prawn-fried-rice.jpg', true, 'NON_VEG', false, 2),
    ('coastal-curry-co', 'Rice and Biryani', 'Steamed Rice', 'Plain boiled rice.', 140, '/images/menu/steamed-rice.jpg', true, 'VEG', false, 3),
    ('coastal-curry-co', 'Rice and Biryani', 'Lemon Rice', 'Tempered with mustard, peanuts and curry leaves.', 190, NULL, true, 'VEG', false, 4),
    ('coastal-curry-co', 'Beverages', 'Sol Kadhi', 'Kokum and coconut milk digestive.', 110, NULL, true, 'VEG', true, 1),
    ('coastal-curry-co', 'Beverages', 'Kokum Sherbet', 'Sweet-sour kokum cooler.', 120, NULL, true, 'VEG', false, 2),
    ('coastal-curry-co', 'Beverages', 'Tender Coconut Water', 'Served in the shell.', 130, NULL, true, 'VEG', false, 3),
    ('coastal-curry-co', 'Beverages', 'Filter Coffee', 'South Indian decoction with frothed milk.', 90, NULL, true, 'VEG', false, 4),
    ('coastal-curry-co', 'Desserts', 'Bebinca', 'Layered Goan coconut and egg pudding.', 220, NULL, true, 'EGG', false, 1),
    ('coastal-curry-co', 'Desserts', 'Ukadiche Modak', 'Steamed rice dumplings with coconut and jaggery.', 180, '/images/menu/modak.jpg', true, 'VEG', false, 2),
    ('coastal-curry-co', 'Desserts', 'Elaneer Payasam', 'Tender coconut and milk pudding.', 190, NULL, true, 'VEG', false, 3),
    -- The Woodpecker Cafe --------------------------------------------------
    ('woodpecker-cafe', 'Chef''s Specials', 'Carbonara Ramyun', 'Creamy carbonara broth with ramen noodles.', 220, NULL, true, 'VEG', true, 1),
    ('woodpecker-cafe', 'Chef''s Specials', 'Spicy Kimchi Ramyun', 'Fiery kimchi broth with pork and ramen noodles.', 220, NULL, true, 'NON_VEG', true, 2),
    ('woodpecker-cafe', 'Chef''s Specials', 'Tan Tan Ramyun', 'Sesame and chilli broth inspired by Dan Dan noodles.', 220, NULL, true, 'VEG', false, 3),
    ('woodpecker-cafe', 'Korean Specials', 'Korean Gochujang Noodles', 'Stir-fried noodles in spicy gochujang sauce.', 150, NULL, true, 'VEG', false, 1),
    ('woodpecker-cafe', 'Korean Specials', 'Rice Paper Dumplings', 'Steamed dumplings wrapped in translucent rice paper.', 180, NULL, true, 'VEG', false, 2),
    ('woodpecker-cafe', 'Korean Specials', 'Crystal Dumplings', 'Glass noodle and vegetable dumplings, pan-fried.', 200, NULL, true, 'VEG', false, 3),
    ('woodpecker-cafe', 'Small Plates', 'Chilli Potato', 'Crispy potato tossed in chilli soy glaze.', 160, NULL, true, 'VEG', false, 1),
    ('woodpecker-cafe', 'Small Plates', 'Chilli Paneer (8 pcs)', 'Cottage cheese wok-tossed with peppers and spring onion.', 180, NULL, true, 'VEG', false, 2),
    ('woodpecker-cafe', 'Fries & Loaded Fries', 'Classic Fries', NULL, 120, NULL, true, 'VEG', false, 1),
    ('woodpecker-cafe', 'Fries & Loaded Fries', 'Cheese Fries', NULL, 150, NULL, true, 'VEG', false, 2),
    ('woodpecker-cafe', 'Fries & Loaded Fries', 'Peri Peri Fries', NULL, 130, NULL, true, 'VEG', false, 3),
    ('woodpecker-cafe', 'Fries & Loaded Fries', 'Pizza Fries', NULL, 150, NULL, true, 'VEG', false, 4),
    ('woodpecker-cafe', 'Fries & Loaded Fries', 'Loaded Fries', 'Fries piled with cheese sauce, jalapeños and spring onion.', 210, NULL, true, 'VEG', true, 5),
    ('woodpecker-cafe', 'Nachos', 'Cheese Nachos', 'Tortilla chips with house cheese sauce.', 200, NULL, true, 'VEG', false, 1),
    ('woodpecker-cafe', 'Nachos', 'Loaded Nachos', 'Nachos with salsa, sour cream, jalapeños and cheese.', 210, NULL, true, 'VEG', false, 2),
    ('woodpecker-cafe', 'Pizza', 'Margherita', 'Classic tomato base with mozzarella.', 140, NULL, true, 'VEG', false, 1),
    ('woodpecker-cafe', 'Pizza', 'Onion Capsicum', NULL, 150, NULL, true, 'VEG', false, 2),
    ('woodpecker-cafe', 'Pizza', 'Corn Delight', NULL, 150, NULL, true, 'VEG', false, 3),
    ('woodpecker-cafe', 'Pizza', 'Paneer Paradise', NULL, 150, NULL, true, 'VEG', false, 4),
    ('woodpecker-cafe', 'Pizza', 'Woodpecker Special', 'The house pizza — chef''s secret blend of toppings.', 180, NULL, true, 'VEG', true, 5),
    ('woodpecker-cafe', 'Pizza', 'Chicken Onion', NULL, 200, NULL, true, 'NON_VEG', false, 6),
    ('woodpecker-cafe', 'Pizza', 'Chicken Delight', NULL, 250, NULL, true, 'NON_VEG', false, 7),
    ('woodpecker-cafe', 'Garlic Bread & Pasta', 'Cheese Corn Garlic Bread', NULL, 140, NULL, true, 'VEG', false, 1),
    ('woodpecker-cafe', 'Garlic Bread & Pasta', 'Loaded Garlic Bread', 'Garlic bread topped with cheese, olives and jalapeños.', 150, NULL, true, 'VEG', false, 2),
    ('woodpecker-cafe', 'Garlic Bread & Pasta', 'White Sauce Pasta', NULL, 190, NULL, true, 'VEG', false, 3),
    ('woodpecker-cafe', 'Garlic Bread & Pasta', 'Alfredo Pasta', 'Creamy Alfredo with mushrooms.', 220, NULL, true, 'VEG', false, 4),
    ('woodpecker-cafe', 'Garlic Bread & Pasta', 'Red Sauce Pasta', NULL, 190, NULL, true, 'VEG', false, 5),
    ('woodpecker-cafe', 'Garlic Bread & Pasta', 'Mix Sauce Pasta', 'Half white, half red — the best of both.', 200, NULL, true, 'VEG', false, 6),
    ('woodpecker-cafe', 'Sushi', 'Woodpecker Sushi', 'House roll with avocado, cucumber and cream cheese.', 250, NULL, true, 'VEG', true, 1),
    ('woodpecker-cafe', 'Sushi', 'Baby Corn Tempura Sushi', 'Tempura baby corn roll with sriracha mayo.', 250, NULL, true, 'VEG', false, 2),
    ('woodpecker-cafe', 'Sushi', 'Fried Chicken Sushi', 'Crispy chicken roll with spicy mayo.', 300, NULL, true, 'NON_VEG', false, 3),
    ('woodpecker-cafe', 'Burgers & Nuggets', 'Aloo Patty Burger', NULL, 75, NULL, true, 'VEG', false, 1),
    ('woodpecker-cafe', 'Burgers & Nuggets', 'Veggie Delight Burger', NULL, 85, NULL, true, 'VEG', false, 2),
    ('woodpecker-cafe', 'Burgers & Nuggets', 'Chicken Burger', NULL, 120, NULL, true, 'NON_VEG', false, 3),
    ('woodpecker-cafe', 'Burgers & Nuggets', 'Crispy Chicken Burger', NULL, 120, NULL, true, 'NON_VEG', false, 4),
    ('woodpecker-cafe', 'Burgers & Nuggets', 'Chicken Nuggets', NULL, 180, NULL, true, 'NON_VEG', false, 5),
    ('woodpecker-cafe', 'Burgers & Nuggets', 'Peri Peri Nuggets', NULL, 200, NULL, true, 'NON_VEG', false, 6),
    ('woodpecker-cafe', 'Hot Beverages', 'Americano', NULL, 109, NULL, true, 'VEG', false, 1),
    ('woodpecker-cafe', 'Hot Beverages', 'Cappuccino', NULL, 109, NULL, true, 'VEG', false, 2),
    ('woodpecker-cafe', 'Hot Beverages', 'Latte', NULL, 109, NULL, true, 'VEG', false, 3),
    ('woodpecker-cafe', 'Hot Beverages', 'Mocha', NULL, 109, NULL, true, 'VEG', false, 4),
    ('woodpecker-cafe', 'Hot Beverages', 'Hot Chocolate', NULL, 130, NULL, true, 'VEG', true, 5),
    ('woodpecker-cafe', 'Hot Beverages', 'Strawberry Latte', NULL, 180, NULL, true, 'VEG', false, 6),
    ('woodpecker-cafe', 'Cold Beverages', 'Green Tea', NULL, 99, NULL, true, 'VEG', false, 1),
    ('woodpecker-cafe', 'Cold Beverages', 'Ginger Tea', NULL, 99, NULL, true, 'VEG', false, 2),
    ('woodpecker-cafe', 'Cold Beverages', 'Masala Tea', NULL, 99, NULL, true, 'VEG', false, 3),
    ('woodpecker-cafe', 'Cold Beverages', 'Lemon Tea', NULL, 99, NULL, true, 'VEG', false, 4),
    ('woodpecker-cafe', 'Cold Beverages', 'Iced Tea', NULL, 150, NULL, true, 'VEG', false, 5),
    ('woodpecker-cafe', 'Cold Beverages', 'Cold Coffee', NULL, 160, NULL, true, 'VEG', false, 6),
    ('woodpecker-cafe', 'Cold Beverages', 'Strawberry Cold Coffee', NULL, 180, NULL, true, 'VEG', false, 7),
    ('woodpecker-cafe', 'Cold Beverages', 'Hazelnut Cold Coffee', NULL, 180, NULL, true, 'VEG', false, 8),
    ('woodpecker-cafe', 'Cold Beverages', 'Virgin Mojito', 'Mint, lime and soda.', 150, NULL, true, 'VEG', false, 9),
    ('woodpecker-cafe', 'Cold Beverages', 'Green Apple Mojito', NULL, 150, NULL, true, 'VEG', true, 10),
    ('woodpecker-cafe', 'Cold Beverages', 'Spicy Mango Mojito', NULL, 150, NULL, true, 'VEG', false, 11),
    ('woodpecker-cafe', 'Cold Beverages', 'Blackcurrant Mojito', NULL, 150, NULL, true, 'VEG', false, 12),
    ('woodpecker-cafe', 'Cold Beverages', 'Strawberry Shake', NULL, 160, NULL, true, 'VEG', false, 13),
    ('woodpecker-cafe', 'Cold Beverages', 'Kitkat Shake', NULL, 160, NULL, true, 'VEG', false, 14),
    ('woodpecker-cafe', 'Cold Beverages', 'Oreo Shake', NULL, 160, NULL, true, 'VEG', false, 15),
    ('woodpecker-cafe', 'Cold Beverages', 'Banana Milkshake', NULL, 150, NULL, true, 'VEG', false, 16),
    ('woodpecker-cafe', 'Desserts', 'Chocolate Brownie', 'Warm fudge brownie with a scoop of vanilla ice cream.', 120, '/images/menu/brownie.jpg', true, 'EGG', true, 1),
    ('woodpecker-cafe', 'Desserts', 'Choco Lava Cake', 'Molten chocolate cake with vanilla ice cream.', 150, NULL, true, 'EGG', false, 2),
    ('woodpecker-cafe', 'Desserts', 'Biscoff Cheesecake', 'No-bake cheesecake with Lotus Biscoff base.', 160, '/images/menu/cheesecake.jpg', true, 'EGG', false, 3),
    ('woodpecker-cafe', 'Desserts', 'Waffle with Ice Cream', 'Crisp waffle with two scoops and chocolate drizzle.', 160, NULL, true, 'EGG', true, 4)
) AS i(slug, category, name, description, price, image, available, dietary, featured, ord)
JOIN restaurant r ON r.slug = i.slug
JOIN menu_category c ON c.restaurant_id = r.id AND c.name = i.category;

-- ---------------------------------------------------------------------
-- Order history: last 28 days (4 complete weeks) with realistic lunch and dinner peaks.
-- Each paid order has a COMPLETED checkout session, a CAPTURED payment and order items
-- with name/price snapshots. A few failed payments (no order) are added for realism.
-- ---------------------------------------------------------------------
DO $$
DECLARE
    r            record;
    ts           record;
    itm          record;
    v_tz         constant text := 'Asia/Kolkata';
    v_day_start  timestamptz;
    v_created    timestamptz;
    v_table      record;
    v_order_id   uuid;
    v_session_id uuid;
    v_seq        integer;
    v_subtotal   numeric(12,2);
    v_tax        numeric(12,2);
    v_total      numeric(12,2);
    v_qty        integer;
    v_items      jsonb;
    v_lines      integer;
    v_status     text;
    v_method     text;
    d            integer;
    k            integer;
    v_per_day    integer;
    v_slot_rand  numeric;
    v_is_weekend boolean;
    v_actual_dow integer;
BEGIN
    PERFORM setseed(0.4242);

    CREATE TEMP TABLE seed_slot (restaurant_id uuid, created_at timestamptz, failed boolean) ON COMMIT DROP;

    FOR r IN SELECT * FROM restaurant ORDER BY slug LOOP
        -- Historical 27 days (d=1 is yesterday, d=27 is 27 days ago).
        -- Time distribution: 30% lunch (12:00–14:30), 20% afternoon (14:30–19:00), 50% dinner (19:00–23:00).
        -- Weekends generate more orders than weekdays.
        FOR d IN 1..27 LOOP
            v_day_start := (date_trunc('day', now() AT TIME ZONE v_tz) - make_interval(days => d)) AT TIME ZONE v_tz;
            -- 0=Sunday, 1=Monday … 6=Saturday in PostgreSQL extract(dow)
            v_actual_dow := extract(dow from (now() AT TIME ZONE v_tz - make_interval(days => d))::date)::int;
            v_is_weekend := (v_actual_dow = 0 OR v_actual_dow = 6);
            v_per_day := CASE WHEN v_is_weekend THEN 16 + floor(random() * 8)::int ELSE 9 + floor(random() * 7)::int END;
            FOR k IN 1..v_per_day LOOP
                v_slot_rand := random();
                INSERT INTO seed_slot VALUES (
                    r.id,
                    v_day_start + CASE
                        WHEN v_slot_rand < 0.30 THEN make_interval(mins => 720  + floor(random() * 150)::int)  -- 12:00–14:30 (lunch)
                        WHEN v_slot_rand < 0.50 THEN make_interval(mins => 870  + floor(random() * 270)::int)  -- 14:30–19:00 (afternoon)
                        ELSE                         make_interval(mins => 1140 + floor(random() * 240)::int)  -- 19:00–23:00 (dinner)
                    END,
                    random() < 0.06
                );
            END LOOP;
        END LOOP;
        -- Today: a steady stream over the last few hours, plus a handful in the last 45 minutes (still PENDING).
        FOR k IN 1..7 LOOP
            INSERT INTO seed_slot VALUES (r.id, now() - make_interval(mins => 50 + floor(random() * 240)::int), false);
        END LOOP;
        FOR k IN 1..3 LOOP
            INSERT INTO seed_slot VALUES (r.id, now() - make_interval(mins => 3 + floor(random() * 40)::int), false);
        END LOOP;
        INSERT INTO seed_slot VALUES (r.id, now() - interval '95 minutes', true);
    END LOOP;

    FOR ts IN SELECT * FROM seed_slot ORDER BY created_at LOOP
        SELECT * INTO r FROM restaurant WHERE id = ts.restaurant_id;
        SELECT * INTO v_table FROM restaurant_table
            WHERE restaurant_id = r.id AND active ORDER BY random() LIMIT 1;

        -- Build 1-4 order lines from available items.
        v_items := '[]'::jsonb;
        v_subtotal := 0;
        v_lines := 1 + floor(random() * 4)::int;
        FOR itm IN
            SELECT * FROM menu_item WHERE restaurant_id = r.id AND available AND deleted_at IS NULL
            ORDER BY random() LIMIT v_lines
        LOOP
            v_qty := CASE WHEN random() < 0.7 THEN 1 WHEN random() < 0.8 THEN 2 ELSE 3 END;
            v_items := v_items || jsonb_build_object(
                'menuItemId', itm.id, 'name', itm.name, 'unitPrice', itm.price,
                'quantity', v_qty, 'lineTotal', itm.price * v_qty, 'dietary', itm.dietary);
            v_subtotal := v_subtotal + itm.price * v_qty;
        END LOOP;
        v_tax := round(v_subtotal * r.tax_rate_percent / 100, 2);
        v_total := v_subtotal + v_tax;
        v_created := ts.created_at;
        v_method := CASE WHEN random() < 0.72 THEN 'UPI' WHEN random() < 0.85 THEN 'CARD' ELSE 'WALLET' END;

        INSERT INTO checkout_session (restaurant_id, table_id, status, currency, subtotal, tax_amount, total_amount, items, created_at, updated_at)
        VALUES (r.id, v_table.id, CASE WHEN ts.failed THEN 'FAILED' ELSE 'COMPLETED' END, r.currency,
                v_subtotal, v_tax, v_total, v_items, v_created - interval '1 minute', v_created)
        RETURNING id INTO v_session_id;

        IF ts.failed THEN
            INSERT INTO payment (restaurant_id, checkout_session_id, provider, provider_order_id, provider_payment_id,
                                 amount, currency, status, method, failure_reason, created_at, updated_at)
            VALUES (r.id, v_session_id, 'MOCK', 'order_' || substr(md5(v_session_id::text), 1, 14),
                    'pay_' || substr(md5(v_session_id::text || 'p'), 1, 14), v_total, r.currency, 'FAILED', v_method,
                    'Payment declined by issuing bank', v_created - interval '1 minute', v_created);
            CONTINUE;
        END IF;

        UPDATE restaurant SET order_sequence = order_sequence + 1 WHERE id = r.id RETURNING order_sequence INTO v_seq;
        v_status := CASE WHEN v_created < now() - interval '45 minutes' THEN 'SERVED' ELSE 'PENDING' END;

        INSERT INTO customer_order (restaurant_id, table_id, table_name, order_number, checkout_session_id, status,
                                    payment_status, currency, subtotal, tax_amount, total_amount, served_at,
                                    created_at, updated_at)
        VALUES (r.id, v_table.id, v_table.name, v_seq, v_session_id, v_status, 'CAPTURED', r.currency,
                v_subtotal, v_tax, v_total,
                CASE WHEN v_status = 'SERVED' THEN v_created + make_interval(mins => 12 + floor(random() * 20)::int) END,
                v_created, v_created)
        RETURNING id INTO v_order_id;

        INSERT INTO order_item (order_id, menu_item_id, item_name, unit_price, quantity, line_total, dietary)
        SELECT v_order_id, (e->>'menuItemId')::uuid, e->>'name', (e->>'unitPrice')::numeric,
               (e->>'quantity')::int, (e->>'lineTotal')::numeric, e->>'dietary'
        FROM jsonb_array_elements(v_items) e;

        INSERT INTO payment (restaurant_id, checkout_session_id, order_id, order_number, provider, provider_order_id, provider_payment_id,
                             amount, currency, status, method, captured_at, created_at, updated_at)
        VALUES (r.id, v_session_id, v_order_id, v_seq, 'MOCK', 'order_' || substr(md5(v_session_id::text), 1, 14),
                'pay_' || substr(md5(v_session_id::text || 'p'), 1, 14), v_total, r.currency, 'CAPTURED', v_method,
                v_created, v_created - interval '1 minute', v_created);
    END LOOP;
END $$;
