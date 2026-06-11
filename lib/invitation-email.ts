type InvitationEmailInput = {
  inviteeEmail: string;
  projectName: string;
  inviterName: string;
  acceptUrl: string;
  expiresAt: string;
};

export function buildInvitationEmail(input: InvitationEmailInput) {
  const expiryLabel = new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(input.expiresAt));

  const subject = `You've been invited to join ${input.projectName} on Orbit PM`;

  const text = [
    `Hi,`,
    ``,
    `${input.inviterName} invited you to collaborate on "${input.projectName}" in Orbit PM.`,
    ``,
    `Accept your invitation:`,
    input.acceptUrl,
    ``,
    `This link expires on ${expiryLabel}.`,
    ``,
    `— Orbit PM`
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#18202c;">
      <h2 style="color:#2563eb;margin-bottom:8px;">You're invited to Orbit PM</h2>
      <p><strong>${escapeHtml(input.inviterName)}</strong> invited you to collaborate on
      <strong>${escapeHtml(input.projectName)}</strong>.</p>
      <p style="margin:28px 0;">
        <a href="${escapeHtml(input.acceptUrl)}"
           style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;display:inline-block;">
          Accept invitation
        </a>
      </p>
      <p style="color:#687385;font-size:14px;">This link expires on ${escapeHtml(expiryLabel)}.</p>
      <p style="color:#687385;font-size:13px;">If the button doesn't work, copy this URL:<br>${escapeHtml(input.acceptUrl)}</p>
    </div>
  `.trim();

  return { subject, text, html };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
