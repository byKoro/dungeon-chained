import fs from 'node:fs';
import path from 'node:path';

function walk(dir) {
    let res = [];
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, f.name);
        if (f.isDirectory()) res.push(...walk(p));
        else if (p.endsWith('.js')) res.push(p);
    }
    return res;
}

const files = walk('js');
let broken = [];
let totalImports = 0;

for (const f of files) {
    const txt = fs.readFileSync(f, 'utf8');
    const importRegex = /import\s+(?:[\w\s{},*]+from\s+)?['"](.*?)['"]/g;
    let match;
    while ((match = importRegex.exec(txt)) !== null) {
        totalImports++;
        const imp = match[1];
        if (imp.startsWith('.')) {
            const resolved = path.resolve(path.dirname(f), imp);
            if (!fs.existsSync(resolved)) {
                broken.push({ file: f, import: imp, resolved });
            }
        }
    }
}

console.log(`Scanned ${files.length} JS files.`);
console.log(`Checked ${totalImports} imports.`);
console.log(`Broken imports: ${broken.length}`);
if (broken.length > 0) {
    console.error(broken);
    process.exit(1);
}
