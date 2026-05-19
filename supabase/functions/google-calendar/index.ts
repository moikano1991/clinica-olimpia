import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const CLIENT_ID     = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
const CALENDAR_ID   = Deno.env.get("GOOGLE_CALENDAR_ID") ?? "primary";
const SITE_URL      = Deno.env.get("SITE_URL") ?? "https://moikano1991.github.io/clinica-olimpia/";
const REDIRECT_URI  = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-calendar`;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Obtener access token (auto-refresh) ──────────────────────────────
async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.from("settings")
    .select("value").eq("key", "google_tokens").maybeSingle();
  if (!data) return null;

  const tokens = JSON.parse(data.value);

  // Usar token existente si sigue vigente
  if (tokens.expiry && tokens.expiry > Date.now() + 60_000) {
    return tokens.access_token;
  }

  // Refrescar token
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: tokens.refresh_token,
      grant_type:    "refresh_token",
    }),
  });
  const json = await res.json();
  if (!json.access_token) return null;

  const updated = {
    ...tokens,
    access_token: json.access_token,
    expiry: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  await supabase.from("settings").upsert({ key: "google_tokens", value: JSON.stringify(updated) });
  return updated.access_token;
}

// ── Construir evento Google Calendar ────────────────────────────────
function buildEvent(appt: Record<string, unknown>) {
  const { date, time, duration, treatment, patientName, status } = appt as {
    date: string; time: string; duration: number;
    treatment: string; patientName: string; status: string;
  };
  const [h, m] = time.split(":").map(Number);
  const endMin = h * 60 + m + (duration || 60);
  const endTime = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;

  const colorId =
    status === "confirmada" ? "2" :   // verde
    status === "cancelada"  ? "11" :  // rojo
    "5";                              // amarillo (pendiente)

  return {
    summary:     `🦷 ${patientName} — ${treatment}`,
    description: `Paciente: ${patientName}\nTratamiento: ${treatment}\nDentista: Dra. María Florencia Muñoz\nClínica Olimpia · Arturo Prat 350, Of. 506, Temuco`,
    start: { dateTime: `${date}T${time}:00`, timeZone: "America/Santiago" },
    end:   { dateTime: `${date}T${endTime}:00`, timeZone: "America/Santiago" },
    colorId,
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 60 },
        { method: "popup", minutes: 15 },
      ],
    },
  };
}

// ── Handler principal ────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = new URL(req.url);

  // ── GET: callback OAuth de Google ──
  if (req.method === "GET" && url.searchParams.has("code")) {
    const code = url.searchParams.get("code")!;
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri:  REDIRECT_URI,
        grant_type:    "authorization_code",
      }),
    });
    const tokens = await res.json();
    if (!tokens.refresh_token) {
      return new Response("Error: Google no devolvió refresh_token. Asegúrate de revocar el acceso previo en myaccount.google.com y vuelve a intentarlo.", { status: 400 });
    }
    await supabase.from("settings").upsert({
      key: "google_tokens",
      value: JSON.stringify({
        access_token:  tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry: Date.now() + (tokens.expires_in ?? 3600) * 1000,
      }),
    });
    // Redirigir al app con indicador de éxito
    return new Response(null, {
      status: 302,
      headers: { Location: `${SITE_URL}#gcal=ok` },
    });
  }

  // ── GET: generar URL de autorización ──
  if (req.method === "GET" && url.searchParams.get("action") === "auth_url") {
    if (!CLIENT_ID) {
      return new Response(JSON.stringify({ error: "GOOGLE_CLIENT_ID no configurado en Supabase Secrets" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
      client_id:    CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope:        "https://www.googleapis.com/auth/calendar",
      access_type:  "offline",
      prompt:       "consent",
    })}`;
    return new Response(JSON.stringify({ url: authUrl }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // ── GET: verificar conexión ──
  if (req.method === "GET" && url.searchParams.get("action") === "check") {
    const { data } = await supabase.from("settings")
      .select("value").eq("key", "google_tokens").maybeSingle();
    return new Response(JSON.stringify({ connected: !!data }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // ── POST: operaciones de calendario ──
  if (req.method === "POST") {
    const body = await req.json();
    const { action, appointment } = body;

    const accessToken = await getAccessToken();
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "No conectado a Google Calendar" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const BASE = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`;

    if (action === "create") {
      const res = await fetch(BASE, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(buildEvent(appointment)),
      });
      const created = await res.json();
      // Guardar event_id en la cita
      if (created.id && appointment.id) {
        await supabase.from("appointments")
          .update({ google_event_id: created.id })
          .eq("id", appointment.id);
      }
      return new Response(JSON.stringify({ event_id: created.id }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (action === "update" && appointment.google_event_id) {
      await fetch(`${BASE}/${appointment.google_event_id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(buildEvent(appointment)),
      });
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (action === "delete" && appointment.google_event_id) {
      await fetch(`${BASE}/${appointment.google_event_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  return new Response("Not found", { status: 404 });
});
