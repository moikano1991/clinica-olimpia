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
          content: `Eres un asistente que extrae datos de tratamientos dentales desde texto dictado por voz en una clínica dental chilena.

Extrae los datos del siguiente texto y responde ÚNICAMENTE con un objeto JSON válido (sin markdown) con estos campos. Usa null si no se menciona:

{
  "patientName": "Nombre del paciente mencionado (null si no se menciona)",
  "date": "Fecha en YYYY-MM-DD (null si no se menciona, hoy es ${new Date().toISOString().split("T")[0]})",
  "procedure": "Procedimiento dental (null si no se menciona). Valores posibles: Limpieza dental, Extracción simple, Extracción quirúrgica, Obturación resina, Obturación amalgama, Radiografía periapical, Radiografía panorámica, Blanqueamiento, Corona cerámica, Prótesis removible, Implante, Endodoncia, Periodoncia, Ortodoncia consulta, Sellantes",
  "tooth": "Número de pieza dental en nomenclatura FDI/ISO 3950 (ej: 36, 11, 46). Cuadrante 1=sup.der, 2=sup.izq, 3=inf.izq, 4=inf.der. Si menciona varias, separar con coma (ej: '36,46'). null si no se menciona",
  "cost": "Costo total en números enteros pesos chilenos (ej: 50000). Si dice 'cincuenta mil' pon 50000. null si no se menciona",
  "paid": "Monto pagado en números enteros pesos chilenos. null si no se menciona",
  "notes": "Observaciones, notas clínicas o comentarios adicionales (null si no se menciona)"
}

Texto dictado: "${text.replace(/"/g, "'")}"`
        },
      ],
    });

    const block = response.content[0];
    if (block.type !== "text") throw new Error("Sin respuesta de texto");

    const match = block.text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No se encontró JSON");

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
