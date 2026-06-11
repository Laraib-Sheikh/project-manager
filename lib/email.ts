import nodemailer from "nodemailer";

const DEFAULT_FROM = "Orbit PM <laraib.ahhmad@gmail.com>";

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

type SendEmailResult = {
  sent: boolean;
  logged: boolean;
  authFailed?: boolean;
  errorMessage?: string;
};

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const smtpUser = (process.env.SMTP_USER ?? "laraib.ahhmad@gmail.com").trim();
  const smtpPass = normalizeAppPassword(process.env.SMTP_PASS);
  const from = process.env.EMAIL_FROM ?? DEFAULT_FROM;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  if (!smtpPass) {
    logEmailFallback(input);
    return { sent: false, logged: true };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port,
    secure,
    auth: {
      user: smtpUser,
      pass: smtpPass
    },
    tls: {
      minVersion: "TLSv1.2"
    }
  });

  try {
    await transporter.verify();
    await transporter.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text
    });

    return { sent: true, logged: false };
  } catch (error) {
    if (isSmtpAuthError(error)) {
      console.error("[Orbit PM] Gmail SMTP login failed. Use a Gmail App Password, not your normal password.");
      console.error(getSmtpAuthHelp());
      logEmailFallback(input);

      return {
        sent: false,
        logged: true,
        authFailed: true,
        errorMessage: getSmtpAuthHelp()
      };
    }

    throw error;
  }
}

function normalizeAppPassword(value: string | undefined) {
  if (!value) {
    return "";
  }

  return value.trim().replace(/\s+/g, "");
}

function isSmtpAuthError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: string; responseCode?: number; message?: string };
  const message = maybeError.message ?? "";

  return (
    maybeError.code === "EAUTH" ||
    maybeError.responseCode === 535 ||
    message.includes("535-5.7.8") ||
    message.includes("Username and Password not accepted")
  );
}

function getSmtpAuthHelp() {
  return [
    "Gmail rejected the SMTP login.",
    "Create an App Password at https://myaccount.google.com/apppasswords",
    "(Google Account → Security → 2-Step Verification must be ON).",
    "Put the 16-character App Password in SMTP_PASS — not your normal Gmail password."
  ].join(" ");
}

function logEmailFallback(input: SendEmailInput) {
  console.info("[Orbit PM] Email not sent — invitation content logged instead:");
  console.info(`  To: ${input.to}`);
  console.info(`  Subject: ${input.subject}`);
  console.info(`  Body:\n${input.text}`);
}
