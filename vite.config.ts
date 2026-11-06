import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import fs from 'fs';

export default defineConfig({
  server: {
    allowedHosts: ["portaldofornecedor.intelider.com.br", "appcom.intelider.com.br"],
  },
  // O Portal e servido pelo Nginx em infraestrutura Node propria; nao pelo
  // adaptador Cloudflare que o template usa como padrao.
  nitro: {
    preset: "node-server",
  },
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    server: {
      allowedHosts: [
        "portaldofornecedor.intelider.com.br",
        "intelider.com.br",
        "*.intelider.com.br"
      ],
      watch: {
        followSymlinks: false,
      },
      // O Nginx termina o TLS no endereço público. O runtime interno pode
      // ser iniciado em HTTP para evitar um segundo handshake no upstream.
      https:
        process.env.PORTAL_HTTP_INTERNAL === "1"
          ? false
          : {
              key: fs.readFileSync(
                "/etc/letsencrypt/live/portaldofornecedor.intelider.com.br/privkey.pem",
              ),
              cert: fs.readFileSync(
                "/etc/letsencrypt/live/portaldofornecedor.intelider.com.br/fullchain.pem",
              ),
            },
    },
  },
});
