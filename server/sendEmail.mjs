import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config({ quiet: true });

const sendEmail = async (options) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      // secure: process.env.SMTP_PORT == 465, // true for port 465, false for others
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
      },
    });

    const mailOptions = {
      from: `Your App Name <${process.env.NODEMAILER_EMAIL}>`,
      to: options.email,
      subject: options.subject,
      text: options.message,
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("There was an error sending the email. Please try again later.");
  }
};

export default sendEmail;