// js/config.js
// Configuración de conexión a Supabase. La SUPABASE_KEY es la clave
// pública ("publishable"/anon): está diseñada para vivir en el
// navegador. La seguridad real la dan las políticas RLS de la base
// de datos, no el secreto de esta clave.
const CONFIG = {
    SUPABASE_URL: "https://cyytkxivddujuawxeaiu.supabase.co",
    SUPABASE_KEY: "sb_publishable_5I6VTXDY3SucdXlAVwhqSQ_N2L1bnNr",
};

// Cliente único de Supabase. `supabase` (global) lo expone el script
// de la CDN cargado en el <head> de cada página, antes que este archivo.
// persistSession/autoRefreshToken son true por defecto: por eso la
// sesión sobrevive a recargar la página o cerrar el navegador.
const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);