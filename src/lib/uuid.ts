/**
 * Gera identificadores sem importar o módulo Node `crypto` para o bundle do
 * navegador. O runtime do portal (Node e browsers modernos) oferece
 * `crypto.randomUUID`; o fallback mantém as chaves únicas mesmo em runtimes
 * antigos.
 */
export function randomUuid(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}
