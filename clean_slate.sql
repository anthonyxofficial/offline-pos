-- PASO 1: Ve a Supabase -> SQL Editor -> New Query.
-- PASO 2: Pega este comando y dale RUN.

-- ESTO BORRA TODOS LOS PRODUCTOS Y REINICIA EL CONTADOR DE IDs A 1.
TRUNCATE TABLE products RESTART IDENTITY CASCADE;

-- Confirmación
SELECT '✅ BASE DE DATOS LIMPIA. Puedes ingresar el primer producto.' as status;
