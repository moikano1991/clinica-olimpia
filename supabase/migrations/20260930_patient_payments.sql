-- Abonos directos a la deuda general del paciente
CREATE TABLE IF NOT EXISTS patient_payments (
  id           BIGSERIAL PRIMARY KEY,
  patient_id   BIGINT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  method       TEXT NOT NULL DEFAULT 'efectivo' CHECK (method IN ('efectivo','tarjeta','transferencia')),
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  allocations  JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE patient_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patient_payments_all" ON patient_payments
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
