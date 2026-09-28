// buscar-pedidos.js
const fs = require('node:fs');

const token = "APP_USR-7728772652676163-091708-9a73d86cf8677ad7875575aab02c0c09-1598082037";

if (!token) {
  throw new Error('Defina ML_ACCESS_TOKEN antes de executar.');
}

async function main() {
const pedidos = [
    ...new Set(
      fs.readFileSync('pedidos.txt', 'utf8')
        .split(/\r?\n/)
        .map(id => id.trim())
        .filter(Boolean)
    )
];

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function buscarPedido(id) {
    for (let tentativa = 1; tentativa <= 4; tentativa++) {
      const resposta = await fetch(
        `https://api.mercadolibre.com/orders/${encodeURIComponent(id)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json'
          }
        }
      );

      if (resposta.status === 429) {
        await sleep(tentativa * 3000);
        continue;
      }

      if (resposta.status === 404) {
        return { id, erro: 'Pedido não encontrado' };
      }

      if (!resposta.ok) {
        return { id, erro: `${resposta.status} ${await resposta.text()}` };
      }

      const pedido = await resposta.json();

      return {
        id: pedido.id,
        status: pedido.status,
        statusDetail: pedido.status_detail?.code ?? null,
        totalAmount: Number(pedido.total_amount ?? 0),
        paidAmount: Number(pedido.paid_amount ?? 0),
        dateCreated: pedido.date_created ?? null
      };
    }

    return { id, erro: 'Limite 429 após tentativas' };
  }

  const resultados = [];

  for (const id of pedidos) {
    const resultado = await buscarPedido(id);
    resultados.push(resultado);
    console.log(resultado);
    await sleep(250);
  }

  const validos = resultados.filter(r => !r.erro);

  const naoCancelados = validos.filter(
    r => !['cancelled', 'invalid', 'refunded'].includes(r.status)
  );

  console.log('\nRESUMO');
  console.log('Pedidos consultados:', pedidos.length);
  console.log('Pedidos encontrados:', validos.length);
  console.log(
    'Soma total_amount:',
    validos.reduce((soma, p) => soma + p.totalAmount, 0).toFixed(2)
  );
  console.log(
    'Soma paid_amount:',
    validos.reduce((soma, p) => soma + p.paidAmount, 0).toFixed(2)
  );
  console.log(
    'Soma não cancelados:',
    naoCancelados.reduce((soma, p) => soma + p.totalAmount, 0).toFixed(2)
  );

  fs.writeFileSync(
    'resultado-pedidos.json',
    JSON.stringify(resultados, null, 2)
  );

}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
