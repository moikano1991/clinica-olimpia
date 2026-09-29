-- Tratamientos realizados con saldo por pagar deben figurar como "pendiente pago", no "completado"
UPDATE treatments
SET status = 'pendiente pago'
WHERE status = 'completado' AND cost > paid;
