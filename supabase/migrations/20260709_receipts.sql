-- Certificados de recepción de dinero (verificables por QR)
CREATE TABLE IF NOT EXISTS receipts (
  id             BIGSERIAL PRIMARY KEY,
  code           TEXT UNIQUE NOT NULL,
  patient_id     BIGINT REFERENCES patients(id) ON DELETE CASCADE,
  budget_id      BIGINT REFERENCES budgets(id) ON DELETE SET NULL,
  amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'efectivo',
  receipt_number TEXT NOT NULL DEFAULT '',
  concept        TEXT DEFAULT '',
  date           DATE NOT NULL DEFAULT CURRENT_DATE,
  professional   TEXT DEFAULT 'Dra. Maria Florencia Munoz',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on receipts"
  ON receipts FOR ALL USING (true) WITH CHECK (true);
