import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

const {
  NODE_ENV,
  RESEND_API_KEY,
  SMTP_FROM_NAME,
  SMTP_FROM_EMAIL,
} = process.env;

const resend = new Resend(RESEND_API_KEY);

const defaultFromName = SMTP_FROM_NAME || "Sandesh";
const defaultFromEmail = SMTP_FROM_EMAIL || "no-reply@yourdomain.com";
const defaultFromAddress = `${defaultFromName} <${defaultFromEmail}>`;

const sendEmail = async (options = {}) => {
  const { email, to, subject, message, html, cc, bcc, replyTo } = options;
  const recipient = email || to;

  if (!RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY environment variable");
  }

  if (!recipient) {
    throw new Error("Email recipient is required");
  }

  if (!subject) {
    throw new Error("Email subject is required");
  }

  if (!message && !html) {
    throw new Error("Email message or html content is required");
  }

  const emailOptions = {
    from: defaultFromAddress,
    to: recipient,
    subject,
    ...(html && { html }),
    ...(message && !html && { text: message }),
    ...(cc && { cc }),
    ...(bcc && { bcc }),
    ...(replyTo && { reply_to: replyTo }),
  };

  try {
    const { data, error } = await resend.emails.send(emailOptions);
    
    if (error) {
      console.error("Resend API error:", error);
      throw new Error(error.message || "Failed to send email");
    }

    return data;
  } catch (error) {
    const context = NODE_ENV === "production" ? "Resend API" : "Resend API (check API key)";
    console.error(`Error sending email via ${context}:`, error);
    throw new Error("There was an error sending the email. Please try again later.");
  }
};

export default sendEmail;