CREATE TABLE IF NOT EXISTS endodontics (
  id              BIGSERIAL PRIMARY KEY,
  patient_id      BIGINT REFERENCES patients(id) ON DELETE CASCADE,
  professional    TEXT NOT NULL DEFAULT '',
  professional_pct NUMERIC(5,2) DEFAULT 60,
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  tooth           TEXT DEFAULT '',
  endo_type       TEXT DEFAULT 'Unirradicular',
  total_cost      NUMERIC(12,2) DEFAULT 0,
  lab_cost        NUMERIC(12,2) DEFAULT 0,
  paid            NUMERIC(12,2) DEFAULT 0,
  status          TEXT DEFAULT 'en proceso',
  sessions        JSONB DEFAULT '[]',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE endodontics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on endodontics"
  ON endodontics FOR ALL USING (true) WITH CHECK (true);
