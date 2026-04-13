
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://aimvueaukjfahpzffwrj.supabase.co";

const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpbXZ1ZWF1a2pmYWhwemZmd3JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwOTY0ODYsImV4cCI6MjA5MDY3MjQ4Nn0.w0SpuqdINNwW_GqWj6XwEzUtLRYja0nIHYQiTx5hQDw";

export const supabase = createClient(supabaseUrl, supabaseKey);

