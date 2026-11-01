import type { Env } from './types';

export interface Mail { to: string; subject: string; text: string }

/** Provedores: 'dev' grava em email_outbox (testes); 'resend' envia via API HTTP. Sem provedor configurado → falha explícita. */
export async function sendEmail(env: Env, mail: Mail, now = Date.now()): Promise<boolean> {
  try {
    if (env.EMAIL_PROVIDER === 'dev') {
      await env.DB.prepare('INSERT INTO email_outbox (to_email, subject, body, created_at) VALUES (?,?,?,?)').bind(mail.to, mail.subject, mail.text, now).run();
      return true;
    }
    if (env.EMAIL_PROVIDER === 'resend' && env.RESEND_API_KEY && env.EMAIL_FROM) {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: env.EMAIL_FROM, to: [mail.to], subject: mail.subject, text: mail.text })
      });
      return r.ok;
    }
    console.error('email_not_configured');
    return false;
  } catch (e) {
    console.error('email_fail', (e as Error).message); // sem destinatário/corpo nos logs
    return false;
  }
}
