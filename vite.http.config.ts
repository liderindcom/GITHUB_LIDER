import baseConfig from "./vite.config.ts";

/**
 * Runtime HTTP interno do Portal do Fornecedor.
 *
 * O TLS termina no Nginx; manter o upstream em HTTP evita um segundo
 * handshake TLS entre o proxy reverso e o runtime local.
 */
export default {
  ...baseConfig,
  server: {
    allowedHosts: ["portaldofornecedor.intelider.com.br", "appcom.intelider.com.br"],
    host: "127.0.0.1",
    https: false,
  },
  vite: {
    ...(baseConfig as any).vite,
    server: {
      ...((baseConfig as any).vite?.server ?? {}),
      https: false,
    },
  },
};
