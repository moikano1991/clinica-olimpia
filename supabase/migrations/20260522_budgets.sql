-- Tabla de presupuestos / cotizaciones
CREATE TABLE IF NOT EXISTS budgets (
  id          BIGSERIAL PRIMARY KEY,
  patient_id  BIGINT REFERENCES patients(id) ON DELETE CASCADE,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  items       JSONB NOT NULL DEFAULT '[]',
  discount    NUMERIC(5,2) DEFAULT 0,
  notes       TEXT,
  status      TEXT DEFAULT 'borrador',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on budgets"
  ON budgets FOR ALL
  USING (true)
  WITH CHECK (true);
