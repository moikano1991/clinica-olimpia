import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

// Token de seguridad — quien tenga la URL puede ver la agenda
const ICS_TOKEN = Deno.env.get("ICS_TOKEN") ?? "olimpia2026";

function toICSDate(date: string, time: string, addMinutes = 0): string {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const totalMin = h * 60 + min + addMinutes;
  const endH = Math.floor(totalMin / 60);
  const endM = totalMin % 60;
  return `${y}${String(m).padStart(2,"0")}${String(d).padStart(2,"0")}T${String(addMinutes > 0 ? endH : h).padStart(2,"0")}${String(addMinutes > 0 ? endM : min).padStart(2,"0")}00`;
}

function escapeICS(s: string): string {
  return (s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  // Verificar token
  if (token !== ICS_TOKEN) {
    return new Response("Acceso denegado", { status: 401 });
  }

  // Obtener citas + pacientes
  const today = new Date().toISOString().split("T")[0];
  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const { data: appointments } = await supabase
    .from("appointments")
    .select("*")
    .gte("date", threeMonthsAgo)
    .not("status", "eq", "cancelada")
    .order("date");

  const { data: patients } = await supabase
    .from("patients")
    .select("id, name, phone");

  const patientMap: Record<number, { name: string; phone: string }> = {};
  for (const p of (patients || [])) {
    patientMap[p.id] = p;
  }

  // Generar eventos ICS
  const events: string[] = [];
  for (const appt of (appointments || [])) {
    const p = patientMap[appt.patient_id];
    const patientName = p?.name || "Paciente";
    const phone = p?.phone || "";
    const duration = appt.duration || 60;
    const status = appt.status === "confirmada" ? "CONFIRMED" : "TENTATIVE";

    const dtStart = toICSDate(appt.date, appt.time);
    const dtEnd   = toICSDate(appt.date, appt.time, duration);

    const description = [
      `Paciente: ${patientName}`,
      phone ? `Teléfono: ${phone}` : "",
      `Tratamiento: ${appt.treatment}`,
      `Dentista: Dra. María Florencia Muñoz`,
      appt.notes ? `Notas: ${appt.notes}` : "",
      `Estado: ${appt.status}`,
    ].filter(Boolean).join("\\n");

    events.push([
      "BEGIN:VEVENT",
      `UID:clinica-olimpia-${appt.id}@olimpia.cl`,
      `DTSTAMP:${toICSDate(today, "00:00")}Z`,
      `DTSTART;TZID=America/Santiago:${dtStart}`,
      `DTEND;TZID=America/Santiago:${dtEnd}`,
      `SUMMARY:🦷 ${escapeICS(patientName)} — ${escapeICS(appt.treatment)}`,
      `DESCRIPTION:${description}`,
      `LOCATION:Arturo Prat 350\\, Of. 506\\, Temuco`,
      `STATUS:${status}`,
      `BEGIN:VALARM`,
      `TRIGGER:-PT60M`,
      `ACTION:DISPLAY`,
      `DESCRIPTION:Cita en 1 hora — ${escapeICS(patientName)}`,
      `END:VALARM`,
      `BEGIN:VALARM`,
      `TRIGGER:-PT15M`,
      `ACTION:DISPLAY`,
      `DESCRIPTION:Cita en 15 minutos — ${escapeICS(patientName)}`,
      `END:VALARM`,
      "END:VEVENT",
    ].join("\r\n"));
  }

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Clinica Olimpia//Agenda//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:🦷 Agenda Clínica Olimpia",
    "X-WR-CALDESC:Citas de Dra. María Florencia Muñoz",
    "X-WR-TIMEZONE:America/Santiago",
    "BEGIN:VTIMEZONE",
    "TZID:America/Santiago",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:-0300",
    "TZOFFSETTO:-0400",
    "TZNAME:CLT",
    "END:STANDARD",
    "END:VTIMEZONE",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "attachment; filename=clinica-olimpia.ics",
      "Cache-Control": "no-cache, no-store",
    },
  });
});
