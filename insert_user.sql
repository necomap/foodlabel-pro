DELETE FROM users;
INSERT INTO users (id, email, "emailVerified", "passwordHash", "companyName", plan, "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'putin5kg@yahoo.co.jp',
  true,
  '$2a$12$PcL6zHvic7YpceHGxqj4UepgPve3UxHtnNyEFQmXNFYyOzE.Eto4u',
  'FoodLabel Pro',
  'admin',
  true,
  NOW(),
  NOW()
);
SELECT email, length("passwordHash") AS hash_length FROM users;