import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

const {
  NODE_ENV,
  SMTP_FROM_NAME,
  SMTP_FROM_EMAIL,
} = process.env;

const transporter = nodemailer.createTransport({
    host: "smtp.hostinger.com",
    port: 465,
    secure: true,
    auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
    },
});

const getTransporter = () => {
  if (!process.env.NODEMAILER_EMAIL || !process.env.NODEMAILER_PASSWORD) {
    throw new Error(
      "Missing NODEMAILER_EMAIL or NODEMAILER_PASSWORD env vars. Unable to initialise SMTP transport."
    );
  }
  return transporter;
};

const defaultFromName = SMTP_FROM_NAME || "Sandesh";
const defaultFromEmail = SMTP_FROM_EMAIL || process.env.NODEMAILER_EMAIL;
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