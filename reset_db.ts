
import { createClient } from '@supabase/supabase-js';

const url = 'https://idpiiinztgxrnqpezvnx.supabase.co';
const key = 'sb_publishable_ZCsj4KwHZSAIgE8rLzaVsQ_8qzu5HkD';

const supabase = createClient(url, key);

async function resetDatabase() {
    console.log("🧹 Iniciando limpieza de base de datos...");

    // 1. Delete Sales Details (Dependency)
    const { error: err1 } = await supabase.from('sale_details').delete().neq('id', 0);
    if (err1) console.error("Error borrarndo detalles:", err1.message);
    else console.log("✅ Detalles de venta borrados.");

    // 2. Delete Sales
    const { error: err2 } = await supabase.from('sales').delete().neq('id', 0);
    if (err2) console.error("Error borrando ventas:", err2.message);
    else console.log("✅ Ventas borradas.");

    // 3. Delete Expenses
    const { error: err3 } = await supabase.from('expenses').delete().neq('id', 0);
    if (err3) console.error("Error borrando gastos:", err3.message);
    else console.log("✅ Gastos borrados.");

    // 4. Delete Products
    const { error: err4 } = await supabase.from('products').delete().neq('id', 0);
    if (err4) console.error("Error borrando productos:", err4.message);
    else console.log("✅ Productos borrados.");

    console.log("✨ Limpieza completada desde el script.");
    console.log("NOTA: Para reiniciar el contador de IDs a 1, debes ejecutar el comando SQL en Supabase.");
}

resetDatabase();
