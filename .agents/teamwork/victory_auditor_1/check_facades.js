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

const simFiles = walk('js/sim').concat(walk('js/adapters'));
console.log('Auditing files for facades, stubs, and dummy constant returns:');

let suspicious = [];

for (const f of simFiles) {
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    let lineCount = lines.length;
    let commentLines = 0;
    let emptyLines = 0;
    let notImplemented = 0;

    lines.forEach((l, idx) => {
        const trimmed = l.trim();
        if (!trimmed) emptyLines++;
        else if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) commentLines++;
        if (trimmed.includes('NotImplemented') || trimmed.includes('not implemented')) {
            notImplemented++;
            suspicious.push({ file: f, line: idx + 1, reason: 'NotImplemented token' });
        }
    });

    const codeLines = lineCount - emptyLines - commentLines;
    console.log(`- ${f}: total=${lineCount}, code=${codeLines}`);
    if (codeLines < 10) {
        suspicious.push({ file: f, reason: 'Extremely short file (<10 code lines)' });
    }
}

console.log('Suspicious patterns detected:', suspicious);
