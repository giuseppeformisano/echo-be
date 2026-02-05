/**
 * Supabase Client - Backend Configuration
 * Centralizes Supabase connection and configuration
 */

const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

let supabase = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  console.log("✅ [INIT] Supabase client initialized");
} else {
  console.warn(
    "⚠️ [WARN] Supabase credentials not configured. Database operations will fail."
  );
}

module.exports = supabase;
