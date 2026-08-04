const SCRIPT_SECRET = "troque-este-codigo-secreto";

function jsonOutput(status, payload) {
  return ContentService
    .createTextOutput(JSON.stringify(Object.assign({ status: status }, payload)))
    .setMimeType(ContentService.MimeType.JSON);
}

function safeText(value) {
  if (value === null || value === undefined || value === "") return "Nao informado";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "Nao informado";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function makeAttachment(attachment) {
  var bytes = Utilities.base64Decode(attachment.content);
  var contentType = attachment.filename && attachment.filename.match(/\.json$/i)
    ? "application/json"
    : "image/jpeg";

  if (attachment.filename && attachment.filename.match(/\.png$/i)) contentType = "image/png";
  if (attachment.filename && attachment.filename.match(/\.webp$/i)) contentType = "image/webp";

  return Utilities.newBlob(bytes, contentType, attachment.filename || "anexo");
}

function doGet() {
  return jsonOutput(405, { ok: false, error: "Metodo nao permitido. Use POST." });
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : "{}");

    if (!body.secret || body.secret !== SCRIPT_SECRET) {
      return jsonOutput(401, { ok: false, error: "Secret invalido." });
    }

    var assessment = body.assessment || {};
    var personal = assessment.personalData || {};
    var attachments = (body.attachments || []).map(makeAttachment);

    MailApp.sendEmail({
      to: body.to || "marcosestevees@icloud.com",
      subject: body.subject || "Nova Anamnese H.E.R.O.",
      body: [
        "Nova anamnese recebida.",
        "",
        "Aluno: " + safeText(personal.name),
        "WhatsApp: " + safeText(personal.whatsapp),
        "Email: " + safeText(personal.email),
        "",
        "O resumo completo esta no corpo HTML e o JSON/fotos estao anexados."
      ].join("\n"),
      htmlBody: body.html || "<p>Nova anamnese recebida.</p>",
      name: "Consultoria H.E.R.O.",
      replyTo: personal.email || body.replyTo || "",
      attachments: attachments
    });

    return jsonOutput(200, {
      ok: true,
      sentTo: body.to || "marcosestevees@icloud.com",
      attachments: attachments.length
    });
  } catch (error) {
    return jsonOutput(500, {
      ok: false,
      error: error && error.message ? error.message : String(error)
    });
  }
}
