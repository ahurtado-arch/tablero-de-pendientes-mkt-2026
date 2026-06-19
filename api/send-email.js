import nodemailer from 'nodemailer';

// Solo se permite enviar a correos del equipo (evita abuso del endpoint público).
const ALLOWED_DOMAINS = ['paraleloinmobiliaria.pe'];

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function shell(headerHtml, bodyHtml) {
  return `<div style="margin:0;padding:0;background:#f4f5f7;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(26,50,77,0.08);">
        ${headerHtml}
        ${bodyHtml}
        <tr><td style="padding:20px 32px;background:#f7f9fb;border-top:1px solid #e9eef3;font-size:12px;color:#9aa8b5;text-align:center;">Este es un aviso automático del Tablero TDC Marketing.</td></tr>
      </table>
    </td></tr>
  </table>
</div>`;
}

function rows(items) {
  return items.map((it, i) => {
    const border = i === 0 ? '' : 'border-top:1px solid #e9eef3;';
    const valColor = it.color ? `color:${it.color};` : '';
    const weight = it.strong ? '700' : '600';
    return `<tr><td style="padding:8px 0;color:#7a8a99;${border}vertical-align:top;">${it.label}</td><td align="right" style="padding:8px 0;font-weight:${weight};${valColor}${border}">${esc(it.value)}</td></tr>`;
  }).join('');
}

function detailCard(rowsHtml) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fb;border:1px solid #e4e9ef;border-radius:12px;">
    <tr><td style="padding:18px 22px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px;color:#1A324D;">${rowsHtml}</table>
    </td></tr></table>`;
}

function cta(url, label) {
  return `<table role="presentation" width="100%" style="margin-top:28px;"><tr><td align="center">
    <a href="${esc(url)}" style="display:inline-block;background:#1A324D;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:10px;">${label}</a>
  </td></tr></table>`;
}

function buildVacRequest(d) {
  const subject = `🏖️ ${d.solicitante} solicitó vacaciones`;
  const header = `<tr><td style="background:linear-gradient(135deg,#1A324D 0%,#2E7DC4 100%);padding:28px 32px;">
    <table role="presentation" width="100%"><tr>
      <td style="font-size:22px;font-weight:700;color:#ffffff;">🏖️ Solicitud de vacaciones</td>
      <td align="right" style="font-size:13px;color:#cdd9e5;font-weight:600;">TDC Marketing</td>
    </tr></table></td></tr>`;
  const body = `<tr><td style="padding:32px;">
    <p style="margin:0 0 6px;font-size:16px;color:#1A324D;">Hola <strong>${esc(d.aprobador)}</strong>,</p>
    <p style="margin:0 0 24px;font-size:15px;color:#5b6b7b;line-height:1.5;"><strong style="color:#1A324D;">${esc(d.solicitante)}</strong> ha solicitado vacaciones y queda <strong>pendiente de tu aprobación</strong>.</p>
    ${detailCard(rows([
      { label: '📅 Desde', value: d.fecha_inicio },
      { label: '📅 Hasta', value: d.fecha_fin },
      { label: '🗓️ Días', value: d.dias, color: '#2E7DC4', strong: true },
      { label: '📝 Notas', value: d.notas || '—' },
    ]))}
    ${cta(d.app_url, 'Aprobar o rechazar →')}
  </td></tr>`;
  return { subject, html: shell(header, body) };
}

function buildVacDecision(d) {
  const approved = !!d.approved;
  const estado = approved ? 'APROBADAS' : 'RECHAZADAS';
  const color = approved ? '#1BA572' : '#E8261C';
  const emoji = approved ? '✅' : '❌';
  const subject = `${emoji} Tus vacaciones fueron ${estado}`;
  const header = `<tr><td style="background:${color};padding:32px;text-align:center;">
    <div style="font-size:40px;line-height:1;">${emoji}</div>
    <div style="font-size:22px;font-weight:700;color:#ffffff;margin-top:10px;">Vacaciones ${estado}</div>
  </td></tr>`;
  const body = `<tr><td style="padding:32px;">
    <p style="margin:0 0 6px;font-size:16px;color:#1A324D;">Hola <strong>${esc(d.empleado)}</strong>,</p>
    <p style="margin:0 0 24px;font-size:15px;color:#5b6b7b;line-height:1.5;">Tu solicitud de vacaciones fue <strong style="color:${color};">${estado}</strong>.</p>
    ${detailCard(rows([
      { label: '📅 Desde', value: d.fecha_inicio },
      { label: '📅 Hasta', value: d.fecha_fin },
      { label: '🗓️ Días', value: d.dias, color, strong: true },
      { label: '👤 Decidido por', value: d.decidido_por },
    ]))}
    ${cta(d.app_url, 'Ver detalle →')}
  </td></tr>`;
  return { subject, html: shell(header, body) };
}

const BUILDERS = {
  vac_request: buildVacRequest,
  vac_decision: buildVacDecision,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, to, ...data } = req.body || {};

    if (!type || !BUILDERS[type]) {
      return res.status(400).json({ error: 'type inválido' });
    }
    if (!to || typeof to !== 'string') {
      return res.status(400).json({ error: 'destinatario requerido' });
    }
    const domain = to.split('@')[1] || '';
    if (!ALLOWED_DOMAINS.includes(domain.toLowerCase())) {
      return res.status(403).json({ error: 'destinatario no permitido' });
    }

    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;
    if (!user || !pass) {
      return res.status(500).json({ error: 'Faltan credenciales de correo (GMAIL_USER / GMAIL_APP_PASSWORD)' });
    }

    const { subject, html } = BUILDERS[type](data);

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `"TDC Marketing" <${user}>`,
      to,
      subject,
      html,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('send-email error:', err);
    return res.status(500).json({ error: 'No se pudo enviar el correo' });
  }
}
