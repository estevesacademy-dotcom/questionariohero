const SCRIPT_SECRET = "";
const SPREADSHEET_ID = "";
const DRIVE_FOLDER_ID = "";
const DEFAULT_TO_EMAIL = "marcosestevees@icloud.com";

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

function normalizeSecret(value) {
  return String(value || "").trim().replace(/^["']|["']$/g, "");
}

function isAuthorized(body) {
  var expected = normalizeSecret(SCRIPT_SECRET);
  if (!expected) return true;
  return normalizeSecret(body.secret) === expected;
}

function getOrCreateSpreadsheet() {
  var props = PropertiesService.getScriptProperties();
  var id = SPREADSHEET_ID || props.getProperty("HERO_SPREADSHEET_ID");
  var spreadsheet;

  if (id) {
    spreadsheet = SpreadsheetApp.openById(id);
  } else {
    spreadsheet = SpreadsheetApp.create("Anamneses H.E.R.O.");
    props.setProperty("HERO_SPREADSHEET_ID", spreadsheet.getId());
  }

  var sheet = spreadsheet.getSheetByName("Respostas") || spreadsheet.insertSheet("Respostas");
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "Recebido em",
      "Nome",
      "WhatsApp",
      "Email",
      "Objetivo",
      "Resultado desejado",
      "Fotos",
      "Pasta Drive",
      "JSON completo"
    ]);
  }

  return {
    spreadsheet: spreadsheet,
    sheet: sheet
  };
}

function getOrCreateFolder() {
  var props = PropertiesService.getScriptProperties();
  var id = DRIVE_FOLDER_ID || props.getProperty("HERO_DRIVE_FOLDER_ID");
  var folder;

  if (id) {
    folder = DriveApp.getFolderById(id);
  } else {
    folder = DriveApp.createFolder("Anamneses H.E.R.O. - Fotos e JSON");
    props.setProperty("HERO_DRIVE_FOLDER_ID", folder.getId());
  }

  return folder;
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

function saveSubmission(body) {
  var assessment = body.assessment || {};
  var personal = assessment.personalData || {};
  var objectives = assessment.objectives || {};
  var bodyAssessment = assessment.bodyAssessment || {};
  var attachments = body.attachments || [];
  var timestamp = new Date();
  var studentName = safeText(personal.name).replace(/[\\/:*?"<>|]/g, "-");
  var rootFolder = getOrCreateFolder();
  var submissionFolder = rootFolder.createFolder(
    Utilities.formatDate(timestamp, Session.getScriptTimeZone(), "yyyy-MM-dd HH-mm-ss") + " - " + studentName
  );
  var photoLinks = [];

  attachments.forEach(function(attachment) {
    var blob = makeAttachment(attachment);
    var file = submissionFolder.createFile(blob);
    photoLinks.push(file.getName() + ": " + file.getUrl());
  });

  var jsonFile = submissionFolder.createFile(
    "anamnese-completa.json",
    JSON.stringify(assessment, null, 2),
    MimeType.PLAIN_TEXT
  );

  var store = getOrCreateSpreadsheet();
  store.sheet.appendRow([
    timestamp,
    safeText(personal.name),
    safeText(personal.whatsapp),
    safeText(personal.email),
    safeText(objectives.primaryGoal),
    safeText(bodyAssessment.desiredResult),
    photoLinks.join("\n"),
    submissionFolder.getUrl(),
    jsonFile.getUrl()
  ]);

  return {
    spreadsheetUrl: store.spreadsheet.getUrl(),
    folderUrl: submissionFolder.getUrl(),
    jsonUrl: jsonFile.getUrl(),
    photoLinks: photoLinks
  };
}

function doGet() {
  return jsonOutput(200, {
    ok: true,
    version: "sheets-drive-email-sem-secret-obrigatorio",
    secretRequired: Boolean(normalizeSecret(SCRIPT_SECRET)),
    message: "Web App H.E.R.O. ativo. Use sendHeroTestEmail no editor para testar o envio e POST para receber anamneses."
  });
}

function sendHeroTestEmail() {
  MailApp.sendEmail({
    to: DEFAULT_TO_EMAIL,
    subject: "Teste H.E.R.O. Apps Script - " + new Date().toISOString(),
    body: "Se este e-mail chegou, o Google Apps Script esta autorizado a enviar mensagens.",
    htmlBody: "<p>Se este e-mail chegou, o Google Apps Script esta autorizado a enviar mensagens.</p>",
    name: "Consultoria H.E.R.O."
  });

  Logger.log("Teste enviado. Quota restante: " + MailApp.getRemainingDailyQuota());
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : "{}");

    if (!isAuthorized(body)) {
      return jsonOutput(401, {
        ok: false,
        error: "Secret invalido.",
        hint: "SCRIPT_SECRET esta preenchido no Apps Script e nao bate com GOOGLE_SCRIPT_SECRET. Para simplificar, deixe SCRIPT_SECRET vazio."
      });
    }

    var assessment = body.assessment || {};
    var personal = assessment.personalData || {};
    var saveResult = saveSubmission(body);
    var attachments = (body.attachments || []).map(makeAttachment);
    var emailSent = false;
    var emailError = "";

    try {
      var html = [
        body.html || "<p>Nova anamnese recebida.</p>",
        "<hr>",
        "<p><strong>Backup Google Sheets:</strong> <a href=\"" + saveResult.spreadsheetUrl + "\">Abrir planilha</a></p>",
        "<p><strong>Pasta Drive:</strong> <a href=\"" + saveResult.folderUrl + "\">Abrir pasta da anamnese</a></p>"
      ].join("");

      var options = {
        to: body.to || DEFAULT_TO_EMAIL,
        subject: body.subject || "Nova Anamnese H.E.R.O.",
        body: [
          "Nova anamnese recebida.",
          "",
          "Aluno: " + safeText(personal.name),
          "WhatsApp: " + safeText(personal.whatsapp),
          "Email: " + safeText(personal.email),
          "",
          "Planilha: " + saveResult.spreadsheetUrl,
          "Pasta Drive: " + saveResult.folderUrl
        ].join("\n"),
        htmlBody: html,
        name: "Consultoria H.E.R.O.",
        replyTo: personal.email || body.replyTo || "",
        attachments: attachments
      };

      if (body.cc) options.cc = body.cc;
      if (body.bcc) options.bcc = body.bcc;

      MailApp.sendEmail(options);
      emailSent = true;
    } catch (mailError) {
      emailError = mailError && mailError.message ? mailError.message : String(mailError);
    }

    return jsonOutput(200, {
      ok: true,
      saved: true,
      emailSent: emailSent,
      emailError: emailError,
      sentTo: body.to || DEFAULT_TO_EMAIL,
      cc: body.cc || "",
      bcc: body.bcc || "",
      remainingDailyQuota: MailApp.getRemainingDailyQuota(),
      spreadsheetUrl: saveResult.spreadsheetUrl,
      folderUrl: saveResult.folderUrl,
      jsonUrl: saveResult.jsonUrl,
      attachments: attachments.length
    });
  } catch (error) {
    return jsonOutput(500, {
      ok: false,
      error: error && error.message ? error.message : String(error)
    });
  }
}
