const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  },
  body: JSON.stringify(body)
});

const truncateText = (value, limit = 16000) => {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return text.length > limit ? `${text.slice(0, limit)}\n...[conteúdo reduzido]` : text;
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

exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Método não permitido." });
  }

  const apiKey = getOpenAiKey();
  if (!apiKey.value) {
    return json(500, {
      error: "Chave da OpenAI não encontrada na Function da Netlify.",
      hint: "Adicione OPENAI_API_KEY em Site configuration > Environment variables e faça um novo deploy. A variável precisa estar no mesmo site publicado.",
      acceptedNames: ["OPENAI_API_KEY", "OPENAI_KEY", "OPENAI_SECRET_KEY", "OPENAI_TOKEN"],
      availableOpenAiVars: apiKey.availableOpenAiVars || []
    });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (error) {
    return json(400, { error: "JSON inválido no corpo da requisição." });
  }

  const assessment = body.assessment;
  const photos = Array.isArray(body.photos) ? body.photos.slice(0, 3) : [];

  if (!assessment || typeof assessment !== "object") {
    return json(400, { error: "Questionário ausente ou inválido." });
  }

  const userContent = [
    {
      type: "input_text",
      text: [
        "Analise a anamnese abaixo e gere um diagnóstico individual, profissional e acionável.",
        "Não invente dados ausentes. Quando algo estiver ausente, indique a limitação com elegância.",
        "Não prometa resultado garantido. Não faça diagnóstico médico.",
        "Use linguagem premium, objetiva, humana e adequada ao método H.E.R.O.",
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
    model: process.env.OPENAI_MODEL || "gpt-5.5",
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: [
              "Você é a IA H.E.R.O., treinada no método H.E.R.O. e na direção profissional de Marcos Esteves.",
              "Sua função é transformar anamnese, rotina, objetivo, histórico de saúde, alimentação e fotos opcionais em uma avaliação inicial personalizada.",
              "Você não substitui avaliação médica, nutricional ou profissional presencial.",
              "Sempre responda em português do Brasil, com tom premium, claro e seguro.",
              "Se houver lesão, hipertensão, diabetes, problema cardíaco ou ausência de liberação médica, reforce segurança e orientação profissional."
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
      error: "A OpenAI recusou a requisição.",
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
