import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://fiqxxmuczsmtsfwgggvj.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpcXhxbXVjenNtdHNmd2dnZ3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3ODcxNDYsImV4cCI6MjA5NDM2MzE0Nn0.TF8lCdD5MysSbi_pCTe6ICoBx_qpHIe2kAejDTzi9Gg"
);
