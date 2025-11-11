import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

const {
  NODE_ENV,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SERVICE,
  SMTP_SECURE,
  SMTP_REQUIRE_TLS,
  SMTP_TLS_REJECT_UNAUTHORIZED,
  NODEMAILER_EMAIL,
  NODEMAILER_PASSWORD,
  SMTP_FROM_NAME,
  SMTP_FROM_EMAIL,
} = process.env;

const parseBoolean = (value, defaultValue) => {
  if (value === undefined || value === null || value === "") return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
  return defaultValue;
};

const resolvedPort = Number(SMTP_PORT) || undefined;
const resolvedSecure = parseBoolean(SMTP_SECURE, resolvedPort === 465);

const transporterConfig = {
  auth: {
    user: NODEMAILER_EMAIL,
    pass: NODEMAILER_PASSWORD,
  },
};

if (SMTP_SERVICE) {
  transporterConfig.service = SMTP_SERVICE;
}

if (SMTP_HOST) {
  transporterConfig.host = SMTP_HOST;
  transporterConfig.port = resolvedPort || (resolvedSecure ? 465 : 587);
  transporterConfig.secure = resolvedSecure;
} else if (!SMTP_SERVICE) {
  transporterConfig.service = "gmail";
  if (resolvedPort) {
    transporterConfig.port = resolvedPort;
    transporterConfig.secure = resolvedSecure;
  }
}

if (parseBoolean(SMTP_REQUIRE_TLS, false)) {
  transporterConfig.requireTLS = true;
}

if (SMTP_TLS_REJECT_UNAUTHORIZED !== undefined) {
  transporterConfig.tls = {
    rejectUnauthorized: parseBoolean(SMTP_TLS_REJECT_UNAUTHORIZED, true),
  };
}
let transporter;
const getTransporter = () => {
  if (transporter) return transporter;
  if (!NODEMAILER_EMAIL || !NODEMAILER_PASSWORD) {
    throw new Error(
      "Missing NODEMAILER_EMAIL or NODEMAILER_PASSWORD env vars. Unable to initialise SMTP transport."
    );
  }
  transporter = nodemailer.createTransport(transporterConfig);
  return transporter;
};

const defaultFromName = SMTP_FROM_NAME || "Sandesh";
const defaultFromEmail = SMTP_FROM_EMAIL || NODEMAILER_EMAIL;
const defaultFromAddress = `${defaultFromName} <${defaultFromEmail}>`;

const sendEmail = async (options = {}) => {
  const { email, to, subject, message, html, cc, bcc, attachments, replyTo } = options;
  const recipient = email || to;

  if (!recipient) {
    throw new Error("Email recipient is required");
  }

  if (!subject) {
    throw new Error("Email subject is required");
  }

  if (!message && !html) {
    throw new Error("Email message or html content is required");
  }

  const mailOptions = {
    from: defaultFromAddress,
  to: recipient,
    subject,
    ...(message && { text: message }),
    ...(html && { html }),
    ...(cc && { cc }),
    ...(bcc && { bcc }),
    ...(attachments && { attachments }),
    ...(replyTo && { replyTo }),
  };

  try {
    await getTransporter().sendMail(mailOptions);
  } catch (error) {
    const context = NODE_ENV === "production" ? "SMTP" : "SMTP (check local env settings)";
    console.error(`Error sending email via ${context}:`, error);
    throw new Error("There was an error sending the email. Please try again later.");
  }
};

export default sendEmail;