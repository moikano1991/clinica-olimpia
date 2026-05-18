import Anthropic from "https://esm.sh/@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_KEY") ?? "" });

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { text } = await req.json();
    if (!text) return new Response(JSON.stringify({ error: "Sin texto" }), { status: 400, headers: cors });

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: `Eres un asistente que extrae datos de pacientes dentales desde texto dictado por voz.

Extrae los datos del siguiente texto y responde ÚNICAMENTE con un objeto JSON válido (sin markdown, sin explicaciones extra) con estos campos exactos. Usa null para los campos que no se mencionen:

{
  "name": "Nombre completo del paciente",
  "rut": "RUT chileno con formato ej: 12.345.678-9 (null si no se menciona)",
  "phone": "Teléfono con código 56 adelante ej: 56912345678 (null si no se menciona)",
  "email": "Email (null si no se menciona)",
  "dob": "Fecha nacimiento en YYYY-MM-DD (null si no se menciona)",
  "address": "Dirección completa (null si no se menciona)",
  "notes": "Alergias, condiciones médicas u observaciones (null si no se menciona)"
}

Texto dictado: "${text.replace(/"/g, "'")}"`
        },
      ],
    });

    const block = response.content[0];
    if (block.type !== "text") throw new Error("Sin respuesta de texto");

    const match = block.text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No se encontró JSON en la respuesta");

    const extracted = JSON.parse(match[0]);

    return new Response(JSON.stringify(extracted), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
