export interface TrayCorpProductBody {
  produtoVarianteId: number;
  produtoId: number;
  idPaiExterno?: number;
  sku: string;
  nome: string;
  nomeProdutoPai?: string;
  precoCusto?: number;
  precoDe?: number;
  precoPor?: number;
  ean?: string;

  estoque: {
    estoqueFisico: number;
    estoqueReservado: number;
    centroDistribuicaoId: number;
    alertaEstoque: number;
  }[];

  dataCriacao?: string;
  dataAtualizacao?: string;
  parentId?: number;

  raw_payload: Record<string, unknown>;
}
