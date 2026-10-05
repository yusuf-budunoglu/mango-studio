// Supabase Auth e-posta şablonlarını üretir: `node scripts/build-email-templates.mjs` → supabase/templates/*.html
// Çıktılar Supabase panelinde Authentication → Emails altındaki şablonlara yapıştırılır (konu satırı SUBJECTS'te).
// E-posta istemcileri <style> ve dış CSS'i çoğunlukla atar: tablo düzeni + satır içi stil. Görsel sitenin kendi adresinden.
import { mkdirSync, writeFileSync } from 'node:fs'

const SITE = 'https://mangostudio.design'
const ORANGE = '#FF7A00'

const TEMPLATES = {
  'confirm-signup': {
    subject: 'Confirm your Mango Studio account',
    heading: 'Confirm your email',
    body: 'Thanks for joining Mango Studio. Confirm this email address to finish creating your account.',
    button: 'Confirm email',
    note: 'If you did not create a Mango Studio account, you can ignore this email.',
  },
  'magic-link': {
    subject: 'Your Mango Studio sign-in link',
    heading: 'Sign in to Mango Studio',
    body: 'Use the button below to sign in. The link works once and expires in one hour.',
    button: 'Sign in',
    note: 'If you did not ask to sign in, you can ignore this email. Nobody can get into your account without this link.',
  },
  'reset-password': {
    subject: 'Set a new Mango Studio password',
    heading: 'Set a new password',
    body: 'We received a request to set a new password for your Mango Studio account.',
    button: 'Choose a new password',
    note: 'If you did not ask for this, you can ignore this email. Your password stays the same.',
  },
  'change-email': {
    subject: 'Confirm your new email for Mango Studio',
    heading: 'Confirm your new email',
    body: 'Confirm this address to use it for your Mango Studio account.',
    button: 'Confirm new email',
    note: 'If you did not ask to change your email, you can ignore this message.',
  },
}

const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

const html = ({ subject, heading, body, button, note }) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <title>${subject}</title>
  </head>
  <body style="margin:0; padding:0; background:#f4f1ec;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ec;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; background:#ffffff; border-radius:16px; border:1px solid #e8e2d8;">
            <tr>
              <td style="padding:28px 32px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align:middle;"><img src="${SITE}/brand/mango-mark-96.png" width="36" height="36" alt="" style="display:block; border:0;" /></td>
                    <td style="vertical-align:middle; padding-left:10px; font-family:${font}; font-size:15px; font-weight:800; letter-spacing:0.06em; color:#111111;">MANGO <span style="color:${ORANGE};">STUDIO</span></td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 0; font-family:${font}; font-size:22px; line-height:1.3; font-weight:700; color:#111111;">${heading}</td>
            </tr>
            <tr>
              <td style="padding:12px 32px 0; font-family:${font}; font-size:15px; line-height:1.55; color:#3d3a35;">${body}</td>
            </tr>
            <tr>
              <td style="padding:24px 32px 0;">
                <a href="{{ .ConfirmationURL }}" style="display:inline-block; padding:13px 22px; border-radius:10px; background:${ORANGE}; font-family:${font}; font-size:15px; font-weight:700; color:#1a0d00; text-decoration:none;">${button}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 0; font-family:${font}; font-size:13px; line-height:1.5; color:#6f6a62;">
                Button not working? Copy this link into your browser:<br />
                <a href="{{ .ConfirmationURL }}" style="color:#b35600; word-break:break-all;">{{ .ConfirmationURL }}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 28px; font-family:${font}; font-size:13px; line-height:1.5; color:#6f6a62;">${note}</td>
            </tr>
          </table>
          <p style="margin:16px 0 0; font-family:${font}; font-size:12px; color:#8d877d;">
            <a href="${SITE}" style="color:#8d877d;">mangostudio.design</a>
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
`

mkdirSync('supabase/templates', { recursive: true })
for (const [name, template] of Object.entries(TEMPLATES)) writeFileSync(`supabase/templates/${name}.html`, html(template))
writeFileSync(
  'supabase/templates/SUBJECTS.md',
  `# E-posta konu satırları\n\nSupabase paneli → Authentication → Emails. Her şablonun gövdesi bu klasördeki aynı adlı .html dosyası.\n\n| Supabase şablonu | Dosya | Konu |\n|---|---|---|\n| Confirm signup | confirm-signup.html | ${TEMPLATES['confirm-signup'].subject} |\n| Magic Link | magic-link.html | ${TEMPLATES['magic-link'].subject} |\n| Reset Password | reset-password.html | ${TEMPLATES['reset-password'].subject} |\n| Change Email Address | change-email.html | ${TEMPLATES['change-email'].subject} |\n`,
)
console.log('wrote', Object.keys(TEMPLATES).length, 'templates')
