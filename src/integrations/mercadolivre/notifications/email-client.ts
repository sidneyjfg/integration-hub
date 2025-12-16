import nodemailer from 'nodemailer'

/**
 * Transporter SMTP (Gmail)
 * ⚠️ Em produção, ideal mover credenciais para ENV
 */
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: 'sidney.junio@nerus.com.br',
    pass: 'caxc wots hfcg emyw', // senha de app Gmail
  },
})

/**
 * Envia e-mail para o suporte
 */
export async function sendSupportEmail(
  subject: string,
  message: string
): Promise<void> {

  try {
    await transporter.sendMail({
      from: '"Monitoramento Automático Fulfillment" <sidney.junio@nerus.com.br>',
      to: 'suporteo2@nerus.com.br',
      subject,
      text: message.replace(/<[^>]+>/g, ''),
      html: message,
    })

    console.log('[EMAIL] E-mail enviado para suporte com sucesso')
  } catch (error) {
    console.error('[EMAIL] Falha ao enviar e-mail de suporte', error)
  }
}
