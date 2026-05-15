import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk";

const supabase = createClient(
  "https://fiqxqmuczsmtsfwgggvj.supabase.co",
  Deno.env.get("SB_SERVICE_KEY")!
);

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_KEY")! });
const GREEN_ID = Deno.env.get("GREEN_API_ID")!;
const GREEN_TOKEN = Deno.env.get("GREEN_API_TOKEN")!;

const SYSTEM = `Eres Olimpia 🦷, la recepcionista virtual de Clínica Estética y Dental Olimpia, ubicada en Arturo Prat 350, Of. 506, Temuco.

Tu trabajo es atender a los pacientes por WhatsApp: agendar citas, confirmar, cancelar y responder preguntas.

FLUJO PARA AGENDAR:
1. Saluda con nombre del paciente si ya lo conoces
2. Si es nuevo, pide nombre completo y RUT
3. Busca si existe en la base de datos con buscar_paciente
4. Si no existe, créalo con crear_paciente
5. Pregunta qué tratamiento necesita
6. Ofrece horarios: Lunes a Viernes 9:00–19:00, Sábados 9:00–14:00
7. Confirma fecha y hora con el paciente
8. Registra la cita con crear_cita
9. Confirma al paciente con todos los detalles

REGLAS:
- Responde siempre en español, amable y breve
- Usa emojis con moderación
- Si el paciente confirma una cita, usa confirmar_cita
- Si cancela, usa cancelar_cita
- Dentista: Dr. Rodrigo Soto
- Tratamientos: Limpieza dental, Extracción simple, Extracción quirúrgica, Obturación resina, Blanqueamiento, Radiografía, Endodoncia, Corona cerámica, Implante, Ortodoncia`;

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
];

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  try {
    if (name === "buscar_paciente") {
      let query = supabase.from("patients").select("*");
      if (input.rut) query = query.ilike("rut", `%${input.rut}%`);
      else if (input.nombre) query = query.ilike("name", `%${input.nombre}%`);
      const { data } = await query.limit(5);
      return data?.length ? JSON.stringify(data) : "No se encontró ningún paciente.";
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
        dentist: "Dr. Rodrigo Soto",
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
  const { data } = await supabase
    .from("conversations")
    .select("role, content")
    .eq("phone", phone)
    .order("created_at", { ascending: true })
    .limit(20);
  return (data || []) as Anthropic.MessageParam[];
}

async function saveMessage(phone: string, role: string, content: string) {
  await supabase.from("conversations").insert([{ phone, role, content }]);
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");

  try {
    const body = await req.json();

    // Ignorar mensajes propios o de estado
    if (body.typeWebhook !== "incomingMessageReceived") return new Response("ok");
    if (body.senderData?.sender?.includes("@g.us")) return new Response("ok"); // ignorar grupos

    const chatId: string = body.senderData?.sender;
    const phone: string = chatId?.replace("@c.us", "");
    const text: string = body.messageData?.textMessageData?.textMessage || "";

    if (!text || !chatId) return new Response("ok");

    // Guardar mensaje del usuario
    await saveMessage(phone, "user", text);

    // Obtener historial
    const history = await getHistory(phone);

    // Llamar a Claude con herramientas
    let messages: Anthropic.MessageParam[] = history;
    let response = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1024,
      system: SYSTEM,
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
        system: SYSTEM,
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
