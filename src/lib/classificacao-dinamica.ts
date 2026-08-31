import {
  departamentoMercadologico,
  secaoMercadologica,
  grupoMercadologico,
  subgrupoMercadologico,
} from '@/lib/mock-data';
import { rotuloComprador } from '@/lib/filtro-mercadologico';
import { segmentoIntelider } from '@/lib/acordo-acesso';

export function classificarProduto(p: any, criterio: string): string {
  switch (criterio) {
    case 'segmento':
      return segmentoIntelider(p.departamentoCodigo, p.departamento) || 'Sem Segmento';
    case 'secao':
      return secaoMercadologica(p);
    case 'grupo':
      return grupoMercadologico(p);
    case 'subgrupo':
      return subgrupoMercadologico(p);
    case 'comprador':
      return rotuloComprador(p);
    case 'departamento':
    default:
      return departamentoMercadologico(p);
  }
}
