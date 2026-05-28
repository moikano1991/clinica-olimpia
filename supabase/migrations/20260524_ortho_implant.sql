-- Tabla ortodoncia
CREATE TABLE IF NOT EXISTS orthodontics (
  id              BIGSERIAL PRIMARY KEY,
  patient_id      BIGINT REFERENCES patients(id) ON DELETE CASCADE,
  professional    TEXT NOT NULL DEFAULT '',
  professional_pct NUMERIC(5,2) DEFAULT 0,
  start_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  estimated_end   DATE,
  total_cost      NUMERIC(12,2) DEFAULT 0,
  lab_cost        NUMERIC(12,2) DEFAULT 0,
  bracket_cost    NUMERIC(12,2) DEFAULT 0,
  paid            NUMERIC(12,2) DEFAULT 0,
  status          TEXT DEFAULT 'activo',
  controls        JSONB DEFAULT '[]',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE orthodontics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on orthodontics"
  ON orthodontics FOR ALL USING (true) WITH CHECK (true);

-- Tabla implantología
CREATE TABLE IF NOT EXISTS implantology (
  id              BIGSERIAL PRIMARY KEY,
  patient_id      BIGINT REFERENCES patients(id) ON DELETE CASCADE,
  professional    TEXT NOT NULL DEFAULT '',
  professional_pct NUMERIC(5,2) DEFAULT 0,
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  implant_type    TEXT DEFAULT '',
  tooth           TEXT DEFAULT '',
  total_cost      NUMERIC(12,2) DEFAULT 0,
  lab_cost        NUMERIC(12,2) DEFAULT 0,
  paid            NUMERIC(12,2) DEFAULT 0,
  status          TEXT DEFAULT 'planificado',
  phases          JSONB DEFAULT '[]',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE implantology ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on implantology"
  ON implantology FOR ALL USING (true) WITH CHECK (true);
