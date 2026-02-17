
import { createClient } from '@supabase/supabase-js';

const url = 'https://idpiiinztgxrnqpezvnx.supabase.co';
const key = 'sb_publishable_ZCsj4KwHZSAIgE8rLzaVsQ_8qzu5HkD';

const supabase = createClient(url, key);

async function checkCloud() {
    console.log("🔍 INSPECCIONANDO NUBE...");

    // Get count
    const { count, error } = await supabase.from('products').select('*', { count: 'exact', head: true });

    if (error) {
        console.error("❌ Error al conectar:", error.message);
    } else {
        console.log(`📊 Total Productos en Nube: ${count}`);

        if (count > 0) {
            const { data } = await supabase.from('products').select('id, name').limit(5);
            console.log("Muestra:", data);
            console.log("⚠️ AÚN HAY DATOS. Intentando borrar de nuevo...");

            // Try explicit delete loop
            const { error: delErr } = await supabase.from('products').delete().neq('id', 0);
            if (delErr) console.error("❌ Falló borrado por Script:", delErr.message);
            else console.log("✅ Intento de borrado ejecutado.");
        } else {
            console.log("✅ LA NUBE ESTÁ VACÍA (0 Productos).");
            console.log("Si tú ves productos, son COPIAS LOCALES en tu navegador.");
        }
    }
}

checkCloud();
