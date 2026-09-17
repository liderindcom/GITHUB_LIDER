import { createServerFn } from "@tanstack/react-start";

import {
  buildConsultiveResult,
  type ConsultiveInput,
  type ConsultiveResult,
} from "@/lib/financial-core";

export function consultarNucleoFinanceiroLocal(data: ConsultiveInput): ConsultiveResult {
  return buildConsultiveResult(data);
}

export const consultarNucleoFinanceiro = createServerFn({ method: "GET" })
  .validator((data: ConsultiveInput) => data)
  .handler(({ data }) => buildConsultiveResult(data));
