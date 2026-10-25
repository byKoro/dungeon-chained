// Shared helpers for scripts/*.mjs (Node only, no dependencies).
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Runs a command; returns { ok, code, out }. Never throws on non-zero exit.
// No shell: arguments are passed as an array (no injection). Windows resolves .exe on PATH;
// only .cmd shims would need a shell, and none are used here.
export function run(cmd, args = [], { inherit = false, cwd = ROOT } = {}) {
    const res = spawnSync(cmd, args, {
        cwd,
        encoding: "utf8",
        windowsHide: true,
        stdio: inherit ? "inherit" : "pipe",
    });
    if (res.error) return { ok: false, code: -1, out: String(res.error.message) };
    return { ok: res.status === 0, code: res.status, out: `${res.stdout || ""}${res.stderr || ""}` };
}

export function has(cmd, args = ["--version"]) {
    const r = run(cmd, args);
    return r.code !== -1 && !/not recognized|not found|ENOENT/i.test(r.out) ? r : null;
}

export function python() {
    for (const c of ["python", "python3", "py"]) if (has(c)) return c;
    return null;
}
