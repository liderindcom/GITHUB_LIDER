import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import fs from 'fs';

export default defineConfig({
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
      https: {
        key: fs.readFileSync('/etc/letsencrypt/live/portaldofornecedor.intelider.com.br/privkey.pem'),
        cert: fs.readFileSync('/etc/letsencrypt/live/portaldofornecedor.intelider.com.br/fullchain.pem'),
      },
    },
  },
});
