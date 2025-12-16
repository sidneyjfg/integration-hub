import { FastifyInstance } from "fastify";
import { sincronizarProdutosTraycorp } from "./services/sincronizar-produtos-traycorp";

export async function registrarRotasProdutosTraycorp(app: FastifyInstance) {

  app.post("/", async (_req, reply) => {
    const resultado = await sincronizarProdutosTraycorp();

    return reply.send({
      sucesso: true,
      inseridos: resultado.inseridos,
      invalidos: resultado.invalidos,
    });
  });
}
