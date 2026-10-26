// Processo principal do Electron para o Dungeon Chained (build desktop).
//
// O jogo é web puro (ESM + fetch de JSON/áudio/imagens). O protocolo file://
// não suporta fetch de arquivos locais, então registramos um protocolo
// próprio "app://" que serve os arquivos do app a partir da raiz. Assim o
// runtime (RoomCatalog, TrailerAudio, import.meta.url, etc.) funciona igual
// ao servidor de desenvolvimento, sem precisar reescrever o jogo.

const { app, BrowserWindow, protocol, net, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// Raiz dos arquivos do app. Empacotado, os recursos ficam em
// resources/app.asar; em desenvolvimento, na raiz do projeto.
const APP_ROOT = path.join(__dirname, '..');
const SCHEME = 'app';

// Registra o esquema como "privilegiado" ANTES de o app ficar pronto:
// permite módulos ESM, fetch e tratamento como origem segura (standard).
protocol.registerSchemesAsPrivileged([
    {
        scheme: SCHEME,
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            stream: true,
            bypassCSP: false,
        },
    },
]);

/**
 * Resolve um pathname de URL (app://game/<path>) para um caminho de arquivo
 * dentro de APP_ROOT, barrando qualquer tentativa de sair da raiz (traversal).
 * @param {string} urlPath
 * @returns {string|null}
 */
function resolveWithinRoot(urlPath) {
    // Remove a query/hash e decodifica (%20 etc.).
    let rel = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
    if (rel.startsWith('/')) rel = rel.slice(1);
    if (rel === '') rel = 'index.html';
    const full = path.join(APP_ROOT, rel);
    const normalizedRoot = path.join(APP_ROOT, path.sep);
    if (full !== APP_ROOT && !full.startsWith(normalizedRoot)) return null;
    return full;
}

function registerAppProtocol() {
    protocol.handle(SCHEME, (request) => {
        // Formato: app://game/<caminho relativo>. O host ("game") é ignorado.
        const url = new URL(request.url);
        const target = resolveWithinRoot(url.pathname);
        if (!target) {
            return new Response('Forbidden', { status: 403 });
        }
        return net.fetch(pathToFileURL(target).toString());
    });
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 720,
        backgroundColor: '#05040a',
        autoHideMenuBar: true,
        show: false,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            // Permite o áudio tocar sem gesto do usuário: botão de controle não
            // conta como gesto, e sem isso quem joga só no controle fica mudo.
            autoplayPolicy: 'no-user-gesture-required',
            backgroundThrottling: false,
        },
    });

    // Sem barra de menu nativa (jogo em tela).
    win.setMenuBarVisibility(false);

    // Abrir links externos no navegador padrão, nunca dentro da janela.
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http://') || url.startsWith('https://')) {
            shell.openExternal(url);
        }
        return { action: 'deny' };
    });

    win.once('ready-to-show', () => win.show());
    win.loadURL(`${SCHEME}://game/index.html`);

    // F11 alterna tela cheia; F12 abre o DevTools (depuração).
    win.webContents.on('before-input-event', (event, input) => {
        if (input.type !== 'keyDown') return;
        if (input.key === 'F11') {
            win.setFullScreen(!win.isFullScreen());
            event.preventDefault();
        } else if (input.key === 'F12') {
            win.webContents.toggleDevTools();
            event.preventDefault();
        }
    });

    return win;
}

app.whenReady().then(() => {
    registerAppProtocol();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
