/** Jeronimo's (RMS natureza RS). Fora do portal do fornecedor. */
const JERONIMO_NUMEROS = [
  "13",
  "45",
  "46",
  "49",
  "51",
  "52",
  "53",
  "56",
  "57",
  "58",
  "63",
  "64",
  "71",
  "73",
  "75",
  "76",
  "77",
  "80",
  "81",
  "84",
  "85",
  "86",
  "87",
  "88",
  "89",
  "90",
  "91",
  "92",
] as const;

const JERONIMO_LOCAIS = [
  "132",
  "450",
  "469",
  "493",
  "515",
  "523",
  "531",
  "566",
  "574",
  "582",
  "639",
  "647",
  "710",
  "736",
  "752",
  "760",
  "779",
  "809",
  "817",
  "841",
  "850",
  "868",
  "876",
  "884",
  "892",
  "906",
  "914",
  "922",
] as const;

const excluidas = new Set<string>([...JERONIMO_NUMEROS, ...JERONIMO_LOCAIS]);

export const lojasJeronimoNumeros = JERONIMO_NUMEROS;
export const lojasJeronimoLocais = JERONIMO_LOCAIS;

export const lojaForaDoPortalFornecedor = (id: string): boolean => {
  const cru = String(id ?? "").trim();
  if (!cru) return false;
  if (excluidas.has(cru)) return true;
  const semZero = cru.replace(/^0+(?=\d)/, "");
  return excluidas.has(semZero);
};

export const sqlLojasForaPortal = [...excluidas].map((id) => `'${id}'`).join(",");
