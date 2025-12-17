export interface MercadoLivreNotaBody {
  filePath?: any | null;  
  status?: string
  venda_remessa?: string
  NFe?: string
  serie?: string
  nome?: string
  chave: string
  modalidade?: string
  operacao?: string
  tipo_logistico?: string
  emissao?: string | null
  valor?: string
  valor_total?: string
  frete?: string
  observacao?: string
  data_nfe_ref?: string
  chave_nfe_ref?: string
}
