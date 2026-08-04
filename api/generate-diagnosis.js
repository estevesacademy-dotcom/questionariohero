const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

const json = (status, body) => Response.json(body, {
  status,
  headers: {
    "Cache-Control": "no-store"
  }
});

const truncateText = (value, limit = 16000) => {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return text.length > limit ? `${text.slice(0, limit)}\n...[conteudo reduzido]` : text;
};

const extractOutputText = (response) => {
  if (response.output_text) return response.output_text;

  const chunks = [];
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) chunks.push(content.text);
      if (content.type === "text" && content.text) chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim();
};

const getOpenAiKey = () => {
  const candidates = [
    "OPENAI_API_KEY",
    "OPENAI_KEY",
    "OPENAI_SECRET_KEY",
    "OPENAI_TOKEN"
  ];

  for (const name of candidates) {
    const raw = process.env[name];
    if (!raw) continue;
    const value = raw.trim().replace(/^["']|["']$/g, "").replace(/^Bearer\s+/i, "");
    if (value) return { value, name };
  }

  return {
    value: "",
    name: "",
    availableOpenAiVars: Object.keys(process.env).filter((name) => name.toUpperCase().includes("OPENAI")).sort()
  };
};

const diagnosisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: { type: "string" },
    executiveSummary: { type: "string" },
    objectiveReading: { type: "string" },
    trainingStrategy: { type: "string" },
    healthAndSafety: { type: "string" },
    lifestyleRecovery: { type: "string" },
    nutritionReading: { type: "string" },
    photoReading: { type: "string" },
    heroDirection: { type: "string" },
    alerts: {
      type: "array",
      items: { type: "string" }
    },
    nextSteps: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: [
    "headline",
    "executiveSummary",
    "objectiveReading",
    "trainingStrategy",
    "healthAndSafety",
    "lifestyleRecovery",
    "nutritionReading",
    "photoReading",
    "heroDirection",
    "alerts",
    "nextSteps"
  ]
};

const handleDiagnosis = async (request) => {
  if (request.method !== "POST") {
    return json(405, { error: "Metodo nao permitido." });
  }

  const apiKey = getOpenAiKey();
  if (!apiKey.value) {
    return json(500, {
      error: "Chave da OpenAI nao encontrada na Vercel.",
      hint: "Adicione OPENAI_API_KEY em Project Settings > Environment Variables e faca um novo deploy de producao.",
      acceptedNames: ["OPENAI_API_KEY", "OPENAI_KEY", "OPENAI_SECRET_KEY", "OPENAI_TOKEN"],
      availableOpenAiVars: apiKey.availableOpenAiVars || []
    });
  }

  let body;
  try {
    body = await request.json();
  } catch (error) {
    return json(400, { error: "JSON invalido no corpo da requisicao." });
  }

  const assessment = body.assessment;
  const photos = Array.isArray(body.photos) ? body.photos.slice(0, 3) : [];

  if (!assessment || typeof assessment !== "object") {
    return json(400, { error: "Questionario ausente ou invalido." });
  }

  const userContent = [
    {
      type: "input_text",
      text: [
        "Analise a anamnese abaixo e gere um diagnostico individual, profissional e acionavel.",
        "Nao invente dados ausentes. Quando algo estiver ausente, indique a limitacao com elegancia.",
        "Nao prometa resultado garantido. Nao faca diagnostico medico.",
        "Use linguagem premium, objetiva, humana e adequada ao metodo H.E.R.O.",
        "",
        truncateText(assessment)
      ].join("\n")
    }
  ];

  for (const photo of photos) {
    if (photo && photo.dataUrl && /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(photo.dataUrl)) {
      userContent.push({
        type: "input_text",
        text: `Foto corporal enviada: ${photo.label || photo.type || "imagem"}`
      });
      userContent.push({
        type: "input_image",
        image_url: photo.dataUrl
      });
    }
  }

  const openaiPayload = {
    model: process.env.OPENAI_MODEL || "gpt-5",
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: [
              "Voce e a IA H.E.R.O., treinada no metodo H.E.R.O. e na direcao profissional de Marcos Esteves.",
              "Sua funcao e transformar anamnese, rotina, objetivo, historico de saude, alimentacao e fotos opcionais em uma avaliacao inicial personalizada.",
              "Voce nao substitui avaliacao medica, nutricional ou profissional presencial.",
              "Sempre responda em portugues do Brasil, com tom premium, claro e seguro.",
              "Se houver lesao, hipertensao, diabetes, problema cardiaco ou ausencia de liberacao medica, reforce seguranca e orientacao profissional."
            ].join(" ")
          }
        ]
      },
      {
        role: "user",
        content: userContent
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "hero_diagnosis",
        strict: true,
        schema: diagnosisSchema
      }
    }
  };

  let openaiResponse;
  try {
    openaiResponse = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey.value}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(openaiPayload)
    });
  } catch (error) {
    return json(502, { error: "Falha ao conectar com a OpenAI.", detail: error.message });
  }

  const result = await openaiResponse.json().catch(() => ({}));
  if (!openaiResponse.ok) {
    return json(openaiResponse.status, {
      error: "A OpenAI recusou a requisicao.",
      detail: result.error?.message || "Sem detalhe retornado."
    });
  }

  try {
    const outputText = extractOutputText(result);
    const diagnosis = JSON.parse(outputText);
    return json(200, { diagnosis, model: openaiPayload.model });
  } catch (error) {
    return json(502, {
      error: "A IA respondeu fora do formato esperado.",
      detail: error.message,
      raw: extractOutputText(result).slice(0, 1200)
    });
  }
};

export default {
  fetch: handleDiagnosis
};

export const GET = handleDiagnosis;
export const POST = handleDiagnosis;
