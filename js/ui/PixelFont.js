/**
 * PixelFont — fonte bitmap minúscula (caixa-alta 3x5, x-height 4) desenhada
 * pixel a pixel. Sem arquivo de fonte: nada para carregar, nitidez garantida.
 *
 * Coordenadas em "pixels de arte": a linha 0 é o topo das maiúsculas, a linha
 * 4 é a base, a linha 5 é o descendente. Acentos ocupam as linhas -2..-1
 * (minúsculas) ou -3..-2 (maiúsculas). Desenhe num canvas pequeno e amplie
 * com imageSmoothingEnabled = false.
 */

// Cada glifo: linhas de '#'/'.'; `top` = linha onde começa (padrão 0).
const G = (top, ...rows) => ({ top, rows, w: rows[0].length });

const GLYPHS = {
    // --- Maiúsculas (linhas 0..4) ---
    A: G(0, '.#.', '#.#', '###', '#.#', '#.#'),
    B: G(0, '##.', '#.#', '##.', '#.#', '##.'),
    C: G(0, '.##', '#..', '#..', '#..', '.##'),
    D: G(0, '##.', '#.#', '#.#', '#.#', '##.'),
    E: G(0, '###', '#..', '##.', '#..', '###'),
    F: G(0, '###', '#..', '##.', '#..', '#..'),
    G: G(0, '.##', '#..', '#.#', '#.#', '.##'),
    H: G(0, '#.#', '#.#', '###', '#.#', '#.#'),
    I: G(0, '###', '.#.', '.#.', '.#.', '###'),
    J: G(0, '..#', '..#', '..#', '#.#', '.#.'),
    K: G(0, '#.#', '#.#', '##.', '#.#', '#.#'),
    L: G(0, '#..', '#..', '#..', '#..', '###'),
    M: G(0, '#...#', '##.##', '#.#.#', '#...#', '#...#'),
    N: G(0, '#..#', '##.#', '#.##', '#..#', '#..#'),
    O: G(0, '.#.', '#.#', '#.#', '#.#', '.#.'),
    P: G(0, '##.', '#.#', '##.', '#..', '#..'),
    Q: G(0, '.#.', '#.#', '#.#', '##.', '.##'),
    R: G(0, '##.', '#.#', '##.', '#.#', '#.#'),
    S: G(0, '.##', '#..', '.#.', '..#', '##.'),
    T: G(0, '###', '.#.', '.#.', '.#.', '.#.'),
    U: G(0, '#.#', '#.#', '#.#', '#.#', '###'),
    V: G(0, '#.#', '#.#', '#.#', '#.#', '.#.'),
    W: G(0, '#...#', '#...#', '#.#.#', '##.##', '#...#'),
    X: G(0, '#.#', '#.#', '.#.', '#.#', '#.#'),
    Y: G(0, '#.#', '#.#', '.#.', '.#.', '.#.'),
    Z: G(0, '###', '..#', '.#.', '#..', '###'),

    // --- Minúsculas (x-height = linhas 1..4) ---
    a: G(1, '.##', '#.#', '#.#', '.##'),
    b: G(0, '#..', '##.', '#.#', '#.#', '##.'),
    c: G(1, '.##', '#..', '#..', '.##'),
    d: G(0, '..#', '.##', '#.#', '#.#', '.##'),
    e: G(1, '.#.', '###', '#..', '.##'),
    f: G(0, '.##', '#..', '##.', '#..', '#..'),
    g: G(1, '.##', '#.#', '.##', '..#', '##.'),
    h: G(0, '#..', '##.', '#.#', '#.#', '#.#'),
    i: G(0, '#', '.', '#', '#', '#'),
    j: G(0, '.#', '..', '.#', '.#', '.#', '#.'),
    k: G(0, '#..', '#.#', '##.', '#.#', '#.#'),
    l: G(0, '#', '#', '#', '#', '#'),
    m: G(1, '##.#.', '#.#.#', '#.#.#', '#.#.#'),
    n: G(1, '##.', '#.#', '#.#', '#.#'),
    o: G(1, '.#.', '#.#', '#.#', '.#.'),
    p: G(1, '##.', '#.#', '#.#', '##.', '#..'),
    q: G(1, '.##', '#.#', '#.#', '.##', '..#'),
    r: G(1, '#.#', '##.', '#..', '#..'),
    s: G(1, '.##', '#..', '..#', '##.'),
    t: G(0, '.#.', '###', '.#.', '.#.', '..#'),
    u: G(1, '#.#', '#.#', '#.#', '.##'),
    v: G(1, '#.#', '#.#', '#.#', '.#.'),
    w: G(1, '#...#', '#.#.#', '#.#.#', '.#.#.'),
    x: G(1, '#.#', '.#.', '.#.', '#.#'),
    y: G(1, '#.#', '#.#', '.##', '..#', '##.'),
    z: G(1, '###', '..#', '.#.', '###'),

    // --- Dígitos ---
    0: G(0, '###', '#.#', '#.#', '#.#', '###'),
    1: G(0, '.#.', '##.', '.#.', '.#.', '###'),
    2: G(0, '##.', '..#', '.#.', '#..', '###'),
    3: G(0, '##.', '..#', '.#.', '..#', '##.'),
    4: G(0, '#.#', '#.#', '###', '..#', '..#'),
    5: G(0, '###', '#..', '##.', '..#', '##.'),
    6: G(0, '.##', '#..', '###', '#.#', '###'),
    7: G(0, '###', '..#', '.#.', '.#.', '.#.'),
    8: G(0, '###', '#.#', '###', '#.#', '###'),
    9: G(0, '###', '#.#', '###', '..#', '##.'),

    // --- Pontuação ---
    ' ': G(0, '..'),
    '.': G(4, '#'),
    ',': G(4, '.#', '#.'),
    '!': G(0, '#', '#', '#', '.', '#'),
    '?': G(0, '##.', '..#', '.#.', '...', '.#.'),
    ':': G(1, '#', '.', '.', '#'),
    ';': G(1, '.#', '..', '..', '.#', '#.'),
    '-': G(2, '###'),
    '/': G(0, '..#', '..#', '.#.', '#..', '#..'),
    "'": G(0, '#', '#'),
    '"': G(0, '#.#', '#.#'),
    '(': G(0, '.#', '#.', '#.', '#.', '.#'),
    ')': G(0, '#.', '.#', '.#', '.#', '#.'),
    '…': G(4, '#.#.#'),
    '▶': G(0, '#..', '##.', '###', '##.', '#..'),
};

// Acentos (2 linhas, 3 de largura, centralizados sobre a letra base).
const ACCENTS = {
    acute: ['..#', '.#.'],
    grave: ['#..', '.#.'],
    circ: ['.#.', '#.#'],
    tilde: ['.##', '##.'],
    diaer: ['...', '#.#'],
};

// Letra acentuada -> [letra base, acento]. 'i' acentuado usa base sem pingo.
const COMPOSED = {
    'á': ['a', 'acute'], 'à': ['a', 'grave'], 'â': ['a', 'circ'], 'ã': ['a', 'tilde'], 'ä': ['a', 'diaer'],
    'é': ['e', 'acute'], 'ê': ['e', 'circ'], 'è': ['e', 'grave'],
    'í': ['ı', 'acute'], 'ì': ['ı', 'grave'], 'î': ['ı', 'circ'],
    'ó': ['o', 'acute'], 'ô': ['o', 'circ'], 'õ': ['o', 'tilde'], 'ò': ['o', 'grave'],
    'ú': ['u', 'acute'], 'ü': ['u', 'diaer'], 'ù': ['u', 'grave'],
    'Á': ['A', 'acute'], 'À': ['A', 'grave'], 'Â': ['A', 'circ'], 'Ã': ['A', 'tilde'],
    'É': ['E', 'acute'], 'Ê': ['E', 'circ'], 'Í': ['I', 'acute'],
    'Ó': ['O', 'acute'], 'Ô': ['O', 'circ'], 'Õ': ['O', 'tilde'], 'Ú': ['U', 'acute'],
};
GLYPHS['ı'] = G(1, '#', '#', '#', '#');
GLYPHS['ç'] = G(1, '.##', '#..', '#..', '.##', '.#.');
GLYPHS['Ç'] = G(0, '.##', '#..', '#..', '#..', '.##', '.#.');

const SPACING = 1;      // espaço entre letras
export const LINE_HEIGHT = 10; // inclui espaço para acentos de maiúsculas

function resolve(ch) {
    const comp = COMPOSED[ch];
    if (comp) {
        const base = GLYPHS[comp[0]];
        const accentTop = base.top <= 0 ? -3 : -2;
        return { base, accent: ACCENTS[comp[1]], accentTop };
    }
    return { base: GLYPHS[ch] || GLYPHS['?'], accent: null };
}

/** Largura (px de arte) de uma linha de texto. */
export function measureText(text) {
    let w = 0;
    for (const ch of text) w += resolve(ch).base.w + SPACING;
    return Math.max(0, w - SPACING);
}

/** Quebra o texto em linhas de até maxWidth px de arte (por palavra). */
export function wrapText(text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const word of words) {
        const tryLine = cur ? cur + ' ' + word : word;
        if (cur && measureText(tryLine) > maxWidth) {
            lines.push(cur);
            cur = word;
        } else {
            cur = tryLine;
        }
    }
    if (cur) lines.push(cur);
    return lines;
}

/**
 * Desenha `text` com o topo das maiúsculas em (x, y). Cada pixel de arte vira
 * um fillRect de 1x1 — use num canvas em resolução de arte.
 * `maxChars` limita quantos caracteres aparecem (efeito máquina de escrever).
 * Retorna quantos caracteres foram desenhados.
 */
export function drawText(ctx, text, x, y, color, maxChars = Infinity) {
    ctx.fillStyle = color;
    let cx = x, n = 0;
    for (const ch of text) {
        if (n >= maxChars) break;
        const { base, accent, accentTop } = resolve(ch);
        plot(ctx, base.rows, cx, y + base.top);
        if (accent) plot(ctx, accent, cx + Math.floor((base.w - 3) / 2), y + accentTop);
        cx += base.w + SPACING;
        n++;
    }
    return n;
}

function plot(ctx, rows, x, y) {
    for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        for (let c = 0; c < row.length; c++) {
            if (row[c] === '#') ctx.fillRect(x + c, y + r, 1, 1);
        }
    }
}
