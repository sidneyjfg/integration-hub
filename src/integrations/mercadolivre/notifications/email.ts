import { getClientNameFromHosts } from '../utils/getClientNameFromHosts'
import { sendSupportEmail } from './email-client'

/**
 * Envia e-mail explicando como corrigir token expirado do Mercado Livre
 */
export async function sendNotificationEmail(
  clienteId: string
): Promise<void> {

  const nomeCliente =
    getClientNameFromHosts() || 'Desconhecido'

  const titulo =
    `⚠ Erro de autenticação Mercado Livre — ${nomeCliente} (${clienteId})`

  const stateSafe =
    `${nomeCliente}`
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')

  const mensagem = `
<p>Olá, equipe,</p>

<p>
Ocorreu um erro de autenticação na conta Mercado Livre do cliente
<b>${nomeCliente}</b> (ID: <b>${clienteId}</b>).
</p>

<p>
<b>Motivo:</b> O token de atualização expirou ou já foi utilizado.
É necessário gerar novas credenciais com a conta master.
</p>

<br><br>

<h3>🛠️ Procedimento para renovar o token do Mercado Livre</h3>

<p>Passe exatamente as etapas abaixo para o cliente:</p>

<ol>
  <li>Acesse o Mercado Livre com a <b>conta master administrativa</b>.</li>

  <li>
    Em uma aba do navegador abra:<br>
    <a href="https://developers.mercadolivre.com.br">
      https://developers.mercadolivre.com.br
    </a>
  </li>

  <li>
    Em outra aba abra este link, alterando o valor da variável
    <b>state</b> para um nome único referente ao cliente:<br><br>

<code>
https://auth.mercadolivre.com.br/authorization?response_type=code
&client_id=7728772652676163
&state=${stateSafe}_${clienteId}
&redirect_uri=https://nerus.com.br/callback_ml
</code>
  </li>

  <li>
    A página exibirá um erro 400 — isso é esperado.<br>
    Copie o link completo exibido no navegador.
    <br><br>
    Exemplo:
<pre>
https://nerus.com.br/callback_ml?code=TG-XXXXXXXXX&state=${stateSafe}_${clienteId}
</pre>
  </li>

  <li>
    Substitua o <b>code</b> no comando abaixo e execute no terminal Linux:

<pre>
curl --location 'https://api.mercadolibre.com/oauth/token' \\
--header 'Accept: application/json' \\
--header 'Content-Type: application/x-www-form-urlencoded' \\
--data '{
  "grant_type": "authorization_code",
  "client_id": "7728772652676163",
  "client_secret": "gcqTSgpZcUSeFuvS9EjM5EwO83DzZWwN",
  "code": "COLOQUE_AQUI_O_TG_CAPTURADO",
  "redirect_uri": "https://nerus.com.br/callback_ml"
}'
</pre>
  </li>

  <li>
    O comando retornará algo como:

<pre>
{
 "access_token": "APP_USR-xxxx",
 "refresh_token": "TG-yyyy",
 "user_id": ${clienteId}
}
</pre>
  </li>

  <li>
    Atualize os dados no MySQL:

<pre>
UPDATE userfull
SET accessToken = "NOVO_ACCESS_TOKEN",
    code = "NOVO_REFRESH_TOKEN",
    refreshToken = "NOVO_REFRESH_TOKEN"
WHERE storeno = 1
  AND seqnoAuto = ???;
</pre>
  </li>
</ol>

<br>

<p>
Após esse procedimento, o monitoramento voltará a funcionar normalmente
para o cliente <b>${nomeCliente}</b>.
</p>

<p>
Atenciosamente,<br>
<b>Sistema Automático Nérus</b>
</p>
`

  await sendSupportEmail(titulo, mensagem)
}
