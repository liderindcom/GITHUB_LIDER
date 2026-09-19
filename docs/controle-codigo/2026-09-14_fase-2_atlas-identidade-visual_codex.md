# Registro CODE — identidade visual Atlas

- Data: 2026-09-14
- Autor: Codex
- Fase: 2 / Atlas interno
- Status: validado localmente

## Entrega

O logo original Atlas fornecido no Google Drive foi armazenado como ativo local e aplicado ao shell compartilhado do Atlas e ao cabeçalho de impressão.

Arquivos:
- atlas/prototype/brand/logo-atlas.jpg
- atlas/prototype/index.html
- atlas/prototype/styles.css
- runtime /lider/portal-fornecedor/public/atlas/brand/logo-atlas.jpg

## Comportamento

A marca aparece em todas as visões do protótipo Atlas pelo shell lateral. Em impressão, o cabeçalho Atlas é exibido e os controles de navegação são ocultados. O logo é servido localmente, sem dependência do Google Drive.

## Validação

- Logo original: JPEG 1168x784, 142113 bytes.
- Runtime HTTPS interno: GET /atlas/brand/logo-atlas.jpg retornou 200 e 142113 bytes.
- O processo do Portal foi reiniciado pelo supervisor e a porta 8090 foi restaurada.

## CODE

- CODE-01: aprovado localmente.
- CODE-02: ativo; ativo estático sem segredo.
- CODE-03: parcial; entrega HTTP validada, inspeção visual pelo usuário pendente.
- CODE-04: pendente de revisão funcional.
- CODE-05: ativo; aplicado somente ao Atlas.
