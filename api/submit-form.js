const RESEND_EMAIL_URL = "https://api.resend.com/emails";
const DEFAULT_TO_EMAIL = "marcosestevees@icloud.com";
const DEFAULT_FROM_EMAIL = "Consultoria H.E.R.O. <onboarding@resend.dev>";
const DEFAULT_SMTP_FROM = "Consultoria H.E.R.O.";

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

const cleanEnvValue = (value = "") => String(value).trim().replace(/^["']|["']$/g, "");

const isValidAppsScriptWebAppUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname === "script.google.com"
      && /^\/macros\/s\/[^/]+\/exec$/.test(url.pathname);
  } catch (error) {
    return false;
  }
};

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

const sendWithGoogleAppsScript = async ({ assessment, photos, to, cc, bcc, html, subject, replyTo }) => {
  const scriptUrl = cleanEnvValue(process.env.GOOGLE_SCRIPT_URL || "");
  if (!scriptUrl) return { configured: false };

  if (!isValidAppsScriptWebAppUrl(scriptUrl)) {
    return {
      configured: true,
      response: json(500, {
        ok: false,
        error: "GOOGLE_SCRIPT_URL invalida.",
        detail: "A URL precisa ser a URL do Web App publicado no Apps Script e deve terminar com /exec.",
        hint: "Use uma URL neste formato: https://script.google.com/macros/s/SEU_DEPLOYMENT_ID/exec. Nao use link do editor, docs.google.com, /dev, Google Drive ou Deployment ID sozinho."
      })
    };
  }

  const scriptSecret = cleanEnvValue(process.env.GOOGLE_SCRIPT_SECRET || "");

  const scriptResponse = await fetch(scriptUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({
      secret: scriptSecret,
      to,
      cc,
      bcc,
      subject,
      html,
      replyTo,
      assessment,
      attachments: buildAttachments(assessment, photos)
    })
  });

  const raw = await scriptResponse.text();
  const contentType = scriptResponse.headers.get("content-type") || "";
  let result = {};
  try {
    result = JSON.parse(raw);
  } catch (error) {
    result = { raw };
  }

  if (contentType.includes("text/html") || raw.trim().startsWith("<")) {
    return {
      configured: true,
      response: json(502, {
        ok: false,
        error: "A URL do Apps Script retornou uma pagina HTML, nao a API da anamnese.",
        detail: raw.includes("Page Not Found")
          ? "O Google retornou Page Not Found. Isso acontece quando GOOGLE_SCRIPT_URL nao e a URL correta do Web App publicado."
          : "A resposta do Google veio em HTML, entao a URL configurada nao apontou para o endpoint JSON esperado.",
        hint: "No Apps Script, va em Deploy > Manage deployments > copie a Web app URL. Ela deve comecar com https://script.google.com/macros/s/ e terminar com /exec. Atualize GOOGLE_SCRIPT_URL na Vercel e faca Redeploy."
      })
    };
  }

  if (!scriptResponse.ok || result.ok === false) {
    return {
      configured: true,
      response: json(scriptResponse.status || 502, {
        ok: false,
        error: "O Google Apps Script recusou o envio.",
        detail: result.error || result.detail || raw.slice(0, 500) || "Sem detalhe retornado.",
        hint: "Confira se o Web App do Apps Script esta publicado como 'Anyone'. Para eliminar erro de segredo, deixe SCRIPT_SECRET vazio no Apps Script e remova GOOGLE_SCRIPT_SECRET da Vercel."
      })
    };
  }

  return {
    configured: true,
    response: json(200, {
      ok: true,
      provider: "google-apps-script",
      sentTo: to,
      photosAttached: photos.length,
      saved: result.saved === true,
      emailSent: result.emailSent === true,
      emailError: result.emailError || "",
      storageErrors: Array.isArray(result.storageErrors) ? result.storageErrors : [],
      spreadsheetUrl: result.spreadsheetUrl || "",
      folderUrl: result.folderUrl || "",
      remainingDailyQuota: result.remainingDailyQuota
    })
  };
};

const sendWithSmtp = async ({ assessment, photos, to, from, html, subject, replyTo }) => {
  const smtpUser = cleanEnvValue(process.env.SMTP_USER || "");
  const smtpPass = cleanEnvValue(process.env.SMTP_PASS || "");

  if (!smtpUser || !smtpPass) {
    return {
      configured: false,
      response: json(500, {
        ok: false,
        error: "Envio por e-mail nao configurado.",
        hint: "Configure RESEND_API_KEY ou use SMTP sem dominio proprio com SMTP_USER e SMTP_PASS na Vercel."
      })
    };
  }

  const nodemailer = await import("nodemailer");
  const smtpHost = cleanEnvValue(process.env.SMTP_HOST || "");
  const smtpService = cleanEnvValue(process.env.SMTP_SERVICE || "");
  const smtpPort = Number(process.env.SMTP_PORT || (smtpHost === "smtp.mail.me.com" ? 587 : 465));
  const smtpSecure = String(process.env.SMTP_SECURE || (smtpPort === 465 ? "true" : "false")).toLowerCase() === "true";
  const smtpRequireTls = String(process.env.SMTP_REQUIRE_TLS || (smtpPort === 587 ? "true" : "false")).toLowerCase() === "true";
  const sender = process.env.FORM_FROM_EMAIL || `${DEFAULT_SMTP_FROM} <${smtpUser}>`;

  const transportOptions = smtpService
    ? {
        service: smtpService,
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      }
    : {
        host: smtpHost || "smtp.gmail.com",
        port: smtpPort,
        secure: smtpSecure,
        requireTLS: smtpRequireTls,
        tls: smtpHost ? { servername: smtpHost } : undefined,
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      };

  const transporter = nodemailer.default.createTransport(transportOptions);
  const attachments = buildAttachments(assessment, photos).map((attachment) => ({
    filename: attachment.filename,
    content: Buffer.from(attachment.content, "base64")
  }));

  const info = await transporter.sendMail({
    from: sender || from,
    to,
    replyTo,
    subject,
    html,
    attachments
  });

  return {
    configured: true,
    response: json(200, {
      ok: true,
      provider: "smtp",
      emailId: info.messageId,
      sentTo: to,
      photosAttached: photos.length
    })
  };
};

const sendWithResend = async ({ assessment, photos, to, from, html, subject, replyTo }) => {
  const resendKey = normalizeEmailKey(process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY || "");
  if (!resendKey) return { configured: false };

  const emailPayload = {
    from,
    to: [to],
    subject,
    html,
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
    return {
      configured: true,
      response: json(resendResponse.status, {
        ok: false,
        error: "O provedor de e-mail recusou o envio.",
        detail: result.message || result.error || "Sem detalhe retornado.",
        sentTo: to,
        from
      })
    };
  }

  return {
    configured: true,
    response: json(200, {
      ok: true,
      provider: "resend",
      emailId: result.id,
      sentTo: to,
      photosAttached: photos.length
    })
  };
};

const handleSubmit = async (request) => {
  if (request.method !== "POST") {
    return json(405, { error: "Metodo nao permitido." });
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
  const cc = process.env.FORM_CC_EMAIL || "";
  const bcc = process.env.FORM_BCC_EMAIL || "";
  const from = process.env.FORM_FROM_EMAIL || DEFAULT_FROM_EMAIL;
  const studentName = assessment.personalData?.name || "Aluno H.E.R.O.";
  const replyTo = assessment.personalData?.email || undefined;
  const subject = `Nova Anamnese H.E.R.O. - ${studentName}`;
  const html = buildEmailHtml(assessment, photos);

  try {
    const googleScript = await sendWithGoogleAppsScript({ assessment, photos, to, cc, bcc, html, subject, replyTo });
    if (googleScript.configured) return googleScript.response;

    const resend = await sendWithResend({ assessment, photos, to, from, html, subject, replyTo });
    if (resend.configured) return resend.response;

    const smtp = await sendWithSmtp({ assessment, photos, to, from, html, subject, replyTo });
    return smtp.response;
  } catch (error) {
    const smtpHint = [
      "Confira SMTP_USER, SMTP_PASS e FORM_FROM_EMAIL na Vercel.",
      "Para iCloud, use senha especifica de app da Apple, nao a senha normal do Apple ID.",
      "Depois de alterar variaveis, faca um novo redeploy de producao."
    ].join(" ");

    return json(502, {
      ok: false,
      error: "Falha ao enviar o e-mail.",
      detail: error.response || error.message || "Erro SMTP sem detalhe retornado.",
      code: error.code || "",
      command: error.command || "",
      responseCode: error.responseCode || "",
      hint: smtpHint
    });
  }
};

export default {
  fetch: handleSubmit
};

export const GET = handleSubmit;
export const POST = handleSubmit;
