# Build desktop (Electron)

Empacota o Dungeon Chained (jogo web) num executável Windows jogável, com o
modo co-op **local** apenas (o modo online foi removido). O trailer de abertura
leva direto ao jogo pelo botão START (ou SKIP).

## Como gerar o `.exe`

```powershell
npm install        # baixa electron + electron-builder
npm run dist       # gera os executáveis em dist/desktop/
```

Saída em `dist/desktop/`:

- `Dungeon Chained-<versao>-x64.exe` — instalador (NSIS), permite escolher a
  pasta de instalação e cria atalhos.
- `Dungeon Chained-<versao>-portable.exe` — executável portátil, roda sem
  instalar.
- `win-unpacked/` — a pasta do app já descompactada (útil para testar).

## Rodar em desenvolvimento

```powershell
npm start          # abre o jogo numa janela Electron
```

## Teclas

- `F11` — alterna tela cheia.
- `F12` — abre o DevTools (depuração).

## Como funciona o empacotamento

O jogo é web puro (ES modules + `fetch` de JSON/áudio/imagens). O protocolo
`file://` do Chromium não suporta `fetch` de arquivos locais, então
`electron/main.cjs` registra um protocolo próprio **`app://`** (via
`protocol.handle` + `net.fetch`) que serve os arquivos do app a partir da raiz.
Assim o runtime (`RoomCatalog`, carregamento de áudio, `import.meta.url`, etc.)
funciona exatamente como no servidor de desenvolvimento, sem reescrever o jogo.

Os recursos empacotados (ver o campo `build.files` do `package.json`):
`index.html`, `css/`, `js/`, `map/`, `assets/`, `pitch/print/`.

> Os tilesets `assets/tileset/tileset_2..6.png` são **opcionais** por design
> (o `AssetLoader` ignora os que não existem). A ausência deles no console
> (`ERR_FILE_NOT_FOUND`) não afeta a jogabilidade.
