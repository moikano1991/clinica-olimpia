import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "https://fiqxqmuczsmtsfwgggvj.supabase.co",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SB_SERVICE_KEY") ?? ""
);

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_KEY") ?? "" });
const GREEN_ID = Deno.env.get("GREEN_API_ID") ?? "";
const GREEN_TOKEN = Deno.env.get("GREEN_API_TOKEN") ?? "";

function buildSystem(): string {
  const now = new Date();
  const fechaHoy = now.toLocaleDateString("es-CL", {
    timeZone: "America/Santiago",
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
  const horaHoy = now.toLocaleTimeString("es-CL", {
    timeZone: "America/Santiago",
    hour: "2-digit", minute: "2-digit"
  });

  return `Eres Olimpia 🦷, la recepcionista virtual de Clínica Estética y Dental Olimpia, ubicada en Arturo Prat 350, Of. 506, Temuco.

Hoy es ${fechaHoy}, hora actual: ${horaHoy} (Chile).

Tu trabajo es atender a los pacientes por WhatsApp: agendar citas, confirmar, cancelar y responder preguntas.

FLUJO PARA AGENDAR:
1. Saluda cordialmente
2. Pide nombre completo y RUT si no los tienes
3. IDENTIFICAR PACIENTE (en este orden estricto):
   a. Si tienes el RUT → buscar_paciente con rut primero (el RUT es el identificador único)
   b. Si el RUT no da resultados → buscar_paciente con nombre como respaldo
   c. Solo si ambas búsquedas fallan → crear_paciente (nunca antes)
4. Si lo encontraste por RUT pero el nombre es diferente, usa igual ese paciente existente — puede estar con nombre distinto o apodo
5. Pregunta qué tratamiento necesita
6. Usa ver_disponibilidad para mostrar horarios libres de los PRÓXIMOS 7 días (empezando desde hoy o mañana)
7. Ofrece máximo 3-4 opciones concretas y cercanas al paciente
8. Confirma fecha y hora con el paciente
9. Registra la cita con crear_cita usando el patient_id del paciente encontrado o creado
10. Confirma al paciente con todos los detalles

REGLAS:
- Responde siempre en español, amable y breve
- Usa emojis con moderación
- NUNCA crear_paciente si ya existe alguien con el mismo RUT — el RUT es único por persona
- SIEMPRE usa ver_disponibilidad antes de proponer horarios — nunca inventes horas
- Ofrece primero los días más cercanos (esta semana o la próxima)
- Horario clínica: Lunes a Viernes 9:00–19:00, Sábados 9:00–14:00
- Cada cita dura 60 minutos por defecto
- Si el paciente confirma una cita, usa confirmar_cita
- Si cancela, usa cancelar_cita
- Dentista: Dra. María Florencia Muñoz
- Tratamientos: Limpieza dental, Extracción simple, Extracción quirúrgica, Obturación resina, Blanqueamiento, Radiografía, Endodoncia, Corona cerámica, Implante, Ortodoncia`;
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: "buscar_paciente",
    description: "Busca un paciente existente por nombre o RUT",
    input_schema: {
      type: "object" as const,
      properties: {
        nombre: { type: "string", description: "Nombre parcial o completo" },
        rut: { type: "string", description: "RUT del paciente" },
      },
    },
  },
  {
    name: "crear_paciente",
    description: "Crea un nuevo paciente en la base de datos",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string" },
        rut: { type: "string" },
        phone: { type: "string" },
        notes: { type: "string" },
      },
      required: ["name", "phone"],
    },
  },
  {
    name: "crear_cita",
    description: "Crea una nueva cita en la agenda",
    input_schema: {
      type: "object" as const,
      properties: {
        patient_id: { type: "number" },
        date: { type: "string", description: "Formato YYYY-MM-DD" },
        time: { type: "string", description: "Formato HH:MM" },
        treatment: { type: "string" },
        duration: { type: "number", description: "Minutos, default 60" },
      },
      required: ["patient_id", "date", "time", "treatment"],
    },
  },
  {
    name: "ver_citas_paciente",
    description: "Ver las citas próximas de un paciente",
    input_schema: {
      type: "object" as const,
      properties: {
        patient_id: { type: "number" },
      },
      required: ["patient_id"],
    },
  },
  {
    name: "confirmar_cita",
    description: "Confirma una cita (cambia estado a confirmada)",
    input_schema: {
      type: "object" as const,
      properties: {
        appointment_id: { type: "number" },
      },
      required: ["appointment_id"],
    },
  },
  {
    name: "cancelar_cita",
    description: "Cancela una cita existente",
    input_schema: {
      type: "object" as const,
      properties: {
        appointment_id: { type: "number" },
      },
      required: ["appointment_id"],
    },
  },
  {
    name: "ver_disponibilidad",
    description: "Ver los horarios disponibles (sin cita) para una fecha o rango de fechas próximas",
    input_schema: {
      type: "object" as const,
      properties: {
        fecha_inicio: { type: "string", description: "Fecha inicio en formato YYYY-MM-DD (usar hoy o mañana)" },
        dias: { type: "number", description: "Cuántos días hacia adelante revisar (default 7)" },
      },
      required: ["fecha_inicio"],
    },
  },
];

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    if (name === "buscar_paciente") {
      if (input.rut) {
        // Normalizar RUT: quitar puntos, guiones y espacios, dejar solo dígitos y k
        const rutNorm = String(input.rut).replace(/[.\-\s]/g, "").toLowerCase();
        // Usar los primeros 7-8 dígitos (sin dígito verificador) para búsqueda flexible
        const rutBase = rutNorm.replace(/[^0-9k]/g, "").slice(0, 8);
        const { data } = await supabase.from("patients").select("*")
          .ilike("rut", `%${rutBase}%`).limit(5);
        if (data?.length) return JSON.stringify(data);
        // Si no encontró por RUT, intentar por nombre como respaldo
        if (input.nombre) {
          const { data: byName } = await supabase.from("patients").select("*")
            .ilike("name", `%${input.nombre}%`).limit(5);
          return byName?.length ? JSON.stringify(byName) : "No se encontró ningún paciente.";
        }
        return "No se encontró ningún paciente.";
      } else if (input.nombre) {
        const { data } = await supabase.from("patients").select("*")
          .ilike("name", `%${input.nombre}%`).limit(5);
        return data?.length ? JSON.stringify(data) : "No se encontró ningún paciente.";
      }
      return "No se encontró ningún paciente.";
    }

    if (name === "crear_paciente") {
      const { data, error } = await supabase.from("patients").insert([input]).select().single();
      if (error) return `Error: ${error.message}`;
      return `Paciente creado con ID ${data.id}`;
    }

    if (name === "crear_cita") {
      const { data, error } = await supabase.from("appointments").insert([{
        patient_id: input.patient_id,
        date: input.date,
        time: input.time,
        treatment: input.treatment,
        duration: input.duration || 60,
        dentist: "Dra. María Florencia Muñoz",
        status: "pendiente",
        notes: "Agendado por WhatsApp",
      }]).select().single();
      if (error) return `Error: ${error.message}`;
      return `Cita creada con ID ${data.id} para el ${data.date} a las ${data.time}`;
    }

    if (name === "ver_citas_paciente") {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase.from("appointments")
        .select("*")
        .eq("patient_id", input.patient_id)
        .gte("date", today)
        .order("date");
      return data?.length ? JSON.stringify(data) : "No tiene citas próximas.";
    }

    if (name === "confirmar_cita") {
      const { error } = await supabase.from("appointments")
        .update({ status: "confirmada" })
        .eq("id", input.appointment_id);
      return error ? `Error: ${error.message}` : "Cita confirmada exitosamente.";
    }

    if (name === "cancelar_cita") {
      const { error } = await supabase.from("appointments")
        .update({ status: "cancelada" })
        .eq("id", input.appointment_id);
      return error ? `Error: ${error.message}` : "Cita cancelada.";
    }

    if (name === "ver_disponibilidad") {
      const fechaInicio = String(input.fecha_inicio);
      const dias = Number(input.dias ?? 7);

      // Calcular rango de fechas
      const start = new Date(fechaInicio + "T00:00:00");
      const end = new Date(start);
      end.setDate(end.getDate() + dias);
      const endStr = end.toISOString().split("T")[0];

      // Obtener citas ya agendadas en ese rango
      const { data: citas } = await supabase.from("appointments")
        .select("date, time, duration")
        .gte("date", fechaInicio)
        .lte("date", endStr)
        .in("status", ["pendiente", "confirmada"])
        .order("date");

      // Construir mapa de horas ocupadas por día
      const ocupadas: Record<string, string[]> = {};
      for (const c of (citas || [])) {
        if (!ocupadas[c.date]) ocupadas[c.date] = [];
        ocupadas[c.date].push(c.time.substring(0, 5));
      }

      // Generar disponibilidad
      const disponibilidad: string[] = [];
      const cur = new Date(start);
      while (cur <= end && disponibilidad.length < 20) {
        const dow = cur.getDay(); // 0=dom, 6=sab
        if (dow !== 0) { // no domingo
          const dateStr = cur.toISOString().split("T")[0];
          const horaFin = dow === 6 ? 14 : 19;
          const horasLibres: string[] = [];
          for (let h = 9; h < horaFin; h++) {
            const slot = `${String(h).padStart(2, "0")}:00`;
            if (!(ocupadas[dateStr] || []).includes(slot)) {
              horasLibres.push(slot);
            }
          }
          if (horasLibres.length > 0) {
            const diaLabel = cur.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
            disponibilidad.push(`${diaLabel}: ${horasLibres.join(", ")}`);
          }
        }
        cur.setDate(cur.getDate() + 1);
      }

      if (disponibilidad.length === 0) return "No hay horarios disponibles en ese rango.";
      return "Horarios disponibles:\n" + disponibilidad.join("\n");
    }

    return "Herramienta no reconocida.";
  } catch (e) {
    return `Error ejecutando herramienta: ${e}`;
  }
}

async function sendWhatsApp(chatId: string, message: string) {
  await fetch(
    `https://api.green-api.com/waInstance${GREEN_ID}/sendMessage/${GREEN_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, message }),
    }
  );
}

async function getHistory(phone: string): Promise<Anthropic.MessageParam[]> {
  // Solo tomar mensajes de las últimas 4 horas (sesión activa)
  const sessionStart = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("conversations")
    .select("role, content")
    .eq("phone", phone)
    .gte("created_at", sessionStart)
    .order("created_at", { ascending: true })
    .limit(20);

  const rows = (data || []) as Anthropic.MessageParam[];

  // Asegurarse de que la historia alterna user/assistant correctamente
  // (evitar dos seguidos del mismo rol que confunde a Claude)
  const clean: Anthropic.MessageParam[] = [];
  for (const msg of rows) {
    if (clean.length === 0 || clean[clean.length - 1].role !== msg.role) {
      clean.push(msg);
    }
  }
  return clean;
}

async function saveMessage(phone: string, role: string, content: string) {
  await supabase.from("conversations").insert([{ phone, role, content }]);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");

  try {
    const body = await req.json();

    // Ignorar todo lo que no sea mensaje entrante de texto
    if (body.typeWebhook !== "incomingMessageReceived") return new Response("ok");
    if (body.senderData?.sender?.includes("@g.us")) return new Response("ok"); // ignorar grupos
    if (body.messageData?.typeMessage !== "textMessage") return new Response("ok"); // ignorar audio, imagen, etc.

    const BOT_PHONE = Deno.env.get("GREEN_API_PHONE") ?? "56967795005";
    const chatId: string = body.senderData?.sender ?? "";
    const phone: string = chatId.replace("@c.us", "");
    const text: string = body.messageData?.textMessageData?.textMessage ?? "";
    const messageId: string = body.idMessage ?? body.messageData?.idMessage ?? "";

    // Ignorar si el mensaje viene del propio bot
    if (phone === BOT_PHONE || chatId === `${BOT_PHONE}@c.us`) return new Response("ok");

    if (!text || !chatId) return new Response("ok");

    // Deduplicación: usar messageId si existe, si no usar phone+text+minuto
    const dedupKey = messageId || `${phone}:${text}:${Math.floor(Date.now() / 60000)}`;
    const { data: existing } = await supabase
      .from("processed_messages")
      .select("id")
      .eq("message_id", dedupKey)
      .maybeSingle();
    if (existing) return new Response("ok");
    await supabase.from("processed_messages").insert([{ message_id: dedupKey }]);

    // Guardar mensaje del usuario
    await saveMessage(phone, "user", text);

    // Obtener historial
    const history = await getHistory(phone);

    // Llamar a Claude con herramientas
    let messages: Anthropic.MessageParam[] = history;
    let response = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1024,
      system: buildSystem(),
      tools: TOOLS,
      messages,
    });

    // Loop de herramientas
    while (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter(b => b.type === "tool_use");
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of toolUseBlocks) {
        if (block.type !== "tool_use") continue;
        const result = await executeTool(block.name, block.input as Record<string, unknown>);
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
      }

      messages = [
        ...messages,
        { role: "assistant", content: response.content },
        { role: "user", content: toolResults },
      ];

      response = await anthropic.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 1024,
        system: buildSystem(),
        tools: TOOLS,
        messages,
      });
    }

    // Extraer respuesta de texto
    const reply = response.content
      .filter(b => b.type === "text")
      .map(b => (b as Anthropic.TextBlock).text)
      .join("\n");

    if (reply) {
      await saveMessage(phone, "assistant", reply);
      await sendWhatsApp(chatId, reply);
    }

    return new Response("ok");
  } catch (e) {
    console.error(e);
    return new Response("error", { status: 500 });
  }
});
