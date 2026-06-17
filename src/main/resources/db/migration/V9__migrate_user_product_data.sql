-- Step 2: Migrate data to new table (purchase_date reset to null — existing TEXT values are incompatible with DATE)
INSERT INTO user_product_new (user_id, product_id, owned, purchase_date, purchase_place, purchase_currency,
                              purchase_price, decal, created_at, updated_at)
SELECT user_id, product_id, owned, null, purchase_place, purchase_currency, purchase_price, decal, created_at, updated_at
FROM user_product;
