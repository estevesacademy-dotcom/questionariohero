const RESEND_EMAIL_URL = "https://api.resend.com/emails";
const DEFAULT_TO_EMAIL = "marcosestevees@icloud.com";
const DEFAULT_FROM_EMAIL = "Consultoria H.E.R.O. <onboarding@resend.dev>";

const json = (status, body) => Response.json(body, {
  status,
  headers: {
    "Cache-Control": "no-store"
  }
});

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const normalizeEmailKey = (value = "") => value.trim().replace(/^["']|["']$/g, "").replace(/^Bearer\s+/i, "");

const formatValue = (value) => {
  if (Array.isArray(value)) return value.length ? value.join(", ") : "Nao informado";
  if (value === true) return "Sim";
  if (value === false) return "Nao";
  if (value === null || value === undefined || value === "") return "Nao informado";
  return String(value);
};

const row = (label, value) => `
  <tr>
    <td style="padding:10px 12px;border-bottom:1px solid #e6eef8;color:#5c6f89;font-size:13px;">${escapeHtml(label)}</td>
    <td style="padding:10px 12px;border-bottom:1px solid #e6eef8;color:#0f2744;font-size:13px;font-weight:600;">${escapeHtml(formatValue(value))}</td>
  </tr>
`;

const section = (title, rows) => `
  <h2 style="margin:24px 0 8px;color:#0b5cff;font-size:15px;letter-spacing:.04em;text-transform:uppercase;">${escapeHtml(title)}</h2>
  <table style="width:100%;border-collapse:collapse;background:#ffffff;border:1px solid #e6eef8;border-radius:8px;overflow:hidden;">${rows}</table>
`;

const buildEmailHtml = (assessment, photos) => {
  const personal = assessment.personalData || {};
  const objectives = assessment.objectives || {};
  const training = assessment.trainingHistory || {};
  const gym = assessment.gymContext || {};
  const health = assessment.healthHistory || {};
  const lifestyle = assessment.lifestyle || {};
  const nutrition = assessment.nutrition || {};
  const body = assessment.bodyAssessment || {};
  const photoMeta = assessment.photos || {};

  return `
    <div style="margin:0;padding:0;background:#f6f9ff;font-family:Inter,Arial,sans-serif;color:#0f2744;">
      <div style="max-width:760px;margin:0 auto;padding:32px 18px;">
        <div style="background:#ffffff;border:1px solid #dbe8f7;border-radius:12px;padding:28px;box-shadow:0 16px 40px rgba(11,92,255,.08);">
          <p style="margin:0 0 8px;color:#0b5cff;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;">Nova anamnese premium</p>
          <h1 style="margin:0;color:#0f2744;font-size:24px;line-height:1.2;">${escapeHtml(personal.name || "Aluno H.E.R.O.")}</h1>
          <p style="margin:10px 0 22px;color:#5c6f89;font-size:14px;line-height:1.6;">Questionario completo recebido pela Consultoria H.E.R.O. O JSON integral e as fotos anexadas seguem neste e-mail.</p>

          ${section("Dados pessoais", [
            row("Nome", personal.name),
            row("Idade", personal.age),
            row("Sexo", personal.sex),
            row("Altura", personal.heightCm ? `${personal.heightCm} cm` : ""),
            row("Peso", personal.weightKg ? `${personal.weightKg} kg` : ""),
            row("WhatsApp", personal.whatsapp),
            row("E-mail", personal.email)
          ].join(""))}

          ${section("Objetivo e treino", [
            row("Objetivo principal", objectives.primaryGoal),
            row("Outro objetivo", objectives.otherGoal),
            row("Experiencia", training.experienceTime),
            row("Frequencia semanal", training.weeklyFrequency),
            row("Ja treinou com personal", training.hasPersonalTrainer),
            row("Ja fez consultoria online", training.didOnlineConsulting),
            row("Local de treino", gym.trainingLocation),
            row("Equipamentos", gym.equipmentAvailable),
            row("Tempo por treino", gym.trainingTimeMinutes ? `${gym.trainingTimeMinutes} minutos` : "")
          ].join(""))}

          ${section("Saude e rotina", [
            row("Possui lesao", health.hasInjury),
            row("Descricao da lesao", health.injuryDescription),
            row("Sinais de atencao", health.flags),
            row("Medicamentos continuos", health.continuousMedication),
            row("Liberacao medica", health.medicalClearance),
            row("Sono", lifestyle.sleepHours),
            row("Agua", lifestyle.waterLiters),
            row("Profissao", lifestyle.profession),
            row("Estresse", lifestyle.stressLevel),
            row("Alcool", lifestyle.alcohol),
            row("Cigarro", lifestyle.smoking)
          ].join(""))}

          ${section("Alimentacao e avaliacao corporal", [
            row("Segue dieta", nutrition.followsDiet),
            row("Ja passou com nutricionista", nutrition.nutritionist),
            row("Restricoes alimentares", nutrition.dietaryRestrictions),
            row("Compulsao alimentar", nutrition.bingeEating),
            row("Refeicoes por dia", nutrition.mealsPerDay),
            row("O que incomoda no corpo", body.bodyDiscomfort),
            row("Resultado desejado", body.desiredResult),
            row("Data especifica", body.targetDate),
            row("Compromisso de enviar fotos depois", photoMeta.sendLaterCommitment),
            row("Fotos anexadas agora", photos.length ? photos.map((photo) => photo.label || photo.fileName).join(", ") : "Nenhuma")
          ].join(""))}

          <p style="margin:22px 0 0;color:#5c6f89;font-size:12px;line-height:1.6;">LGPD: os dados e fotos foram enviados para uso restrito na analise da anamnese, elaboracao do diagnostico H.E.R.O. e suporte profissional.</p>
        </div>
      </div>
    </div>
  `;
};

const dataUrlToAttachment = (photo, index) => {
  const dataUrl = photo && photo.dataUrl;
  const match = typeof dataUrl === "string" ? dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i) : null;
  if (!match) return null;

  const contentType = match[1].replace("image/jpg", "image/jpeg");
  const extension = contentType.split("/")[1].replace("jpeg", "jpg");
  const safeType = String(photo.label || photo.type || `foto-${index + 1}`).toLowerCase().replace(/[^a-z0-9-]+/g, "-");

  return {
    filename: `${safeType || `foto-${index + 1}`}.${extension}`,
    content: match[2]
  };
};

const buildAttachments = (assessment, photos) => {
  const attachments = [
    {
      filename: `anamnese-hero-${Date.now()}.json`,
      content: Buffer.from(JSON.stringify(assessment, null, 2), "utf8").toString("base64")
    }
  ];

  photos.map(dataUrlToAttachment).filter(Boolean).forEach((attachment) => attachments.push(attachment));
  return attachments;
};

const handleSubmit = async (request) => {
  if (request.method !== "POST") {
    return json(405, { error: "Metodo nao permitido." });
  }

  const resendKey = normalizeEmailKey(process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY || "");
  if (!resendKey) {
    return json(500, {
      ok: false,
      error: "RESEND_API_KEY nao configurada na Vercel.",
      hint: "Crie uma conta no Resend, gere uma API key e adicione RESEND_API_KEY em Project Settings > Environment Variables. Depois faca um novo deploy."
    });
  }

  let body;
  try {
    body = await request.json();
  } catch (error) {
    return json(400, { ok: false, error: "JSON invalido no corpo da requisicao." });
  }

  const assessment = body.assessment;
  const photos = Array.isArray(body.photos) ? body.photos.slice(0, 3) : [];

  if (!assessment || typeof assessment !== "object") {
    return json(400, { ok: false, error: "Questionario ausente ou invalido." });
  }

  const to = process.env.FORM_TO_EMAIL || DEFAULT_TO_EMAIL;
  const from = process.env.FORM_FROM_EMAIL || DEFAULT_FROM_EMAIL;
  const studentName = assessment.personalData?.name || "Aluno H.E.R.O.";
  const replyTo = assessment.personalData?.email || undefined;

  const emailPayload = {
    from,
    to: [to],
    subject: `Nova Anamnese H.E.R.O. - ${studentName}`,
    html: buildEmailHtml(assessment, photos),
    attachments: buildAttachments(assessment, photos)
  };

  if (replyTo) emailPayload.reply_to = replyTo;

  const resendResponse = await fetch(RESEND_EMAIL_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(emailPayload)
  });

  const result = await resendResponse.json().catch(() => ({}));
  if (!resendResponse.ok) {
    return json(resendResponse.status, {
      ok: false,
      error: "O provedor de e-mail recusou o envio.",
      detail: result.message || result.error || "Sem detalhe retornado.",
      sentTo: to,
      from
    });
  }

  return json(200, {
    ok: true,
    emailId: result.id,
    sentTo: to,
    photosAttached: photos.length
  });
};

export default {
  fetch: handleSubmit
};

export const GET = handleSubmit;
export const POST = handleSubmit;
