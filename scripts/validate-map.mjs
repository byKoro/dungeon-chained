// Validates map/index.json and every room piece in map/.
// Rules: .agents/context/systems/rooms-and-maps.md (schema table).
// Usage: npm run validate:map            errors fail (exit 1), warnings only print
//        npm run validate:map -- --strict  warnings also fail
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mapDir = join(root, "map");
const strict = process.argv.includes("--strict");

const cfg = await import(pathToFileURL(join(root, "js/config/GameConfig.js")).href);
const ent = await import(pathToFileURL(join(root, "js/config/EntityConfig.js")).href);
const COLS = cfg.ROOM_COLS;
const ROWS = cfg.ROOM_ROWS;
const SPAWNS = cfg.PLAYER_DOOR_SPAWN_TILES;
const ENEMY_KEYS = new Set(Object.keys(ent.ENEMY_TYPE_BY_KEY));

const errors = [];
const warnings = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);
const warn = (file, msg) => warnings.push(`${file}: ${msg}`);

const isInt = (v) => Number.isInteger(v);
const inBounds = (c, r) => isInt(c) && isInt(r) && c >= 0 && c < COLS && r >= 0 && r < ROWS;
const interior = (c, r) => isInt(c) && isInt(r) && c >= 1 && c <= COLS - 2 && r >= 1 && r <= ROWS - 2;
const oneOf = (v, list) => list.includes(v);

const midC = Math.floor(COLS / 2);
const midR = Math.floor(ROWS / 2);
const DOOR_CELLS = {
    N: [[midC - 1, 0], [midC, 0]],
    S: [[midC - 1, ROWS - 1], [midC, ROWS - 1]],
    W: [[0, midR - 1], [0, midR]],
    E: [[COLS - 1, midR - 1], [COLS - 1, midR]],
};
const DOOR_FLOOR = new Set([16, 17]);
const WALL_TILES = new Set([0, 10, 20, 30, 40, 1, 2, 3, 4, 5, 15, 25, 35, 45, 41, 42, 43, 44, 50, 51, 52, 53, 54, 55]);
const BASE_NAME_RE = /^(room_start_hub|room_boss|corridor_horizontal_ew|corridor_vertical_ns|room_corner_[nesw]+|room_cross_4way|(room|corridor)_[nesw]+)_\d+\.json$/;

// ---------- index.json ----------
let listed = [];
try {
    const idx = JSON.parse(readFileSync(join(mapDir, "index.json"), "utf8"));
    if (!Array.isArray(idx.rooms) || !idx.rooms.every((r) => typeof r === "string")) {
        err("index.json", "`rooms` must be an array of file names");
    } else {
        listed = idx.rooms;
    }
} catch (e) {
    err("index.json", `cannot parse: ${e.message}`);
}

const seen = new Set();
for (const name of listed) {
    if (!/^[A-Za-z0-9_\-]+\.json$/.test(name)) err("index.json", `invalid file name "${name}"`);
    if (seen.has(name)) err("index.json", `duplicate entry "${name}"`);
    seen.add(name);
    if (!existsSync(join(mapDir, name))) err("index.json", `lists missing file "${name}"`);
}
const onDisk = readdirSync(mapDir).filter((f) => f.endsWith(".json") && f !== "index.json");
for (const f of onDisk) {
    if (!seen.has(f)) err(f, "exists in map/ but is not listed in map/index.json (never loaded)");
}

// ---------- pieces ----------
const coverage = new Map();

for (const file of onDisk) {
    let p;
    try {
        p = JSON.parse(readFileSync(join(mapDir, file), "utf8"));
    } catch (e) {
        err(file, `cannot parse: ${e.message}`);
        continue;
    }
    if (!p || typeof p !== "object" || Array.isArray(p)) { err(file, "piece must be an object"); continue; }

    // doors
    const doors = p.doors;
    if (!doors || typeof doors !== "object") { err(file, "missing `doors` object"); continue; }
    for (const k of Object.keys(doors)) if (!oneOf(k, ["N", "E", "S", "W"])) warn(file, `unknown door key "${k}"`);
    if (!["N", "E", "S", "W"].some((d) => doors[d])) err(file, "`doors` needs at least one open door");

    // floor
    const floor = p.floor;
    const floorOk = Array.isArray(floor) && floor.length === ROWS &&
        floor.every((row) => Array.isArray(row) && row.length === COLS && row.every((v) => isInt(v) && v >= -2));
    if (!floorOk) { err(file, `\`floor\` must be ${ROWS} rows x ${COLS} ints >= -2`); continue; }
    const at = (c, r) => floor[r][c];

    if (p.cols !== undefined && p.cols !== COLS) err(file, `cols=${p.cols}, expected ${COLS}`);
    if (p.rows !== undefined && p.rows !== ROWS) err(file, `rows=${p.rows}, expected ${ROWS}`);

    // door frame consistency + spawn tiles
    for (const d of ["N", "E", "S", "W"]) {
        const open = !!doors[d];
        const cells = DOOR_CELLS[d].map(([c, r]) => at(c, r));
        if (open && !cells.every((v) => DOOR_FLOOR.has(v))) err(file, `door ${d} is open but frame cells are [${cells}] (expected 16/17)`);
        if (!open && cells.some((v) => DOOR_FLOOR.has(v))) err(file, `door ${d} is closed but frame has floor [${cells}]`);
    }

    // enums
    const type = p.type ?? "normal";
    if (!oneOf(type, ["normal", "start", "boss", "challenge"])) err(file, `type "${p.type}" invalid`);
    if (p.kind !== undefined && !oneOf(p.kind, ["room", "corridor"])) err(file, `kind "${p.kind}" invalid`);
    if (p.lock !== undefined && !oneOf(p.lock, ["auto", "none", "enemies", "buttons"])) err(file, `lock "${p.lock}" invalid`);

    // walls
    const occupied = new Set();
    const walls = p.walls ?? [];
    if (!Array.isArray(walls)) err(file, "`walls` must be an array");
    const wallSet = new Set();
    for (const w of Array.isArray(walls) ? walls : []) {
        const k = `${w.col},${w.row}`;
        if (!inBounds(w.col, w.row)) { err(file, `wall out of bounds at ${k}`); continue; }
        if (!WALL_TILES.has(w.tile)) err(file, `wall ${k} has unknown tile ${w.tile}`);
        if (w.side !== undefined && !oneOf(w.side, ["top", "bottom", "left", "right"])) err(file, `wall ${k} side "${w.side}" invalid`);
        if (wallSet.has(k)) err(file, `duplicate wall at ${k}`);
        if (at(w.col, w.row) === cfg.HOLE_TILE) err(file, `wall on a hole at ${k}`);
        for (const d of ["N", "E", "S", "W"]) {
            if (doors[d] && DOOR_CELLS[d].some(([c, r]) => c === w.col && r === w.row)) err(file, `wall blocks door ${d} at ${k}`);
        }
        wallSet.add(k);
    }

    // player spawn tiles for each open door (+ CENTER for start)
    const spawnDirs = ["N", "E", "S", "W"].filter((d) => doors[d]);
    if (type === "start") spawnDirs.push("CENTER");
    for (const d of spawnDirs) {
        for (const pl of ["p1", "p2"]) {
            const t = SPAWNS[d]?.[pl];
            if (!t) continue;
            const v = at(t.col, t.row);
            if (v < 0) err(file, `spawn ${d}.${pl} (${t.col},${t.row}) is on floor ${v} (hole/empty)`);
            if (wallSet.has(`${t.col},${t.row}`)) err(file, `spawn ${d}.${pl} (${t.col},${t.row}) is blocked by a wall`);
        }
    }

    // holes
    const holes = p.holes ?? [];
    const holeSet = new Set();
    if (!Array.isArray(holes)) err(file, "`holes` must be an array of \"col,row\"");
    for (const h of Array.isArray(holes) ? holes : []) {
        const [c, r] = String(h).split(",").map(Number);
        if (!inBounds(c, r)) { err(file, `hole "${h}" out of bounds`); continue; }
        if (at(c, r) !== cfg.HOLE_TILE) err(file, `hole "${h}" listed but floor is ${at(c, r)}`);
        holeSet.add(`${c},${r}`);
    }
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        if (floor[r][c] === cfg.HOLE_TILE && !holeSet.has(`${c},${r}`)) warn(file, `floor -1 at ${c},${r} not in \`holes\` (editor drops it on re-save)`);
    }

    // enemies
    const enemyTiles = new Set();
    for (const e of p.enemies ?? []) {
        const k = `${e.col},${e.row}`;
        if (!ENEMY_KEYS.has(e.type)) err(file, `enemy type "${e.type}" not in ENEMY_TYPE_BY_KEY`);
        if (!interior(e.col, e.row)) err(file, `enemy at ${k} must be interior`);
        else if (at(e.col, e.row) < 0) warn(file, `enemy at ${k} on floor ${at(e.col, e.row)} (will be relocated)`);
        if (enemyTiles.has(k)) err(file, `two enemies on ${k}`);
        enemyTiles.add(k);
    }

    // hazards
    let buttons = 0;
    for (const h of p.hazards ?? []) {
        if (h.col === undefined && h.u !== undefined) { warn(file, `hazard ${h.type} uses legacy u/v coords`); continue; }
        const k = `${h.col},${h.row}`;
        if (!oneOf(h.type, ["spike", "spikeRow", "arrow", "button"])) { err(file, `hazard type "${h.type}" invalid`); continue; }
        if (h.timing !== undefined && !oneOf(h.timing, ["fast", "normal", "slow"])) err(file, `hazard ${k} timing "${h.timing}" invalid`);
        if (h.delay !== undefined && !(typeof h.delay === "number" && h.delay >= 0)) err(file, `hazard ${k} delay must be a number >= 0`);
        const tiles = [[h.col, h.row]];
        if (h.type === "spikeRow") {
            // ChallengeCorridor defaults a missing dir to "left" (horizontal row).
            const dir = h.dir ?? "left";
            if (!oneOf(dir, ["left", "right", "up", "down"])) err(file, `spikeRow ${k} dir "${h.dir}" invalid`);
            if (!(isInt(h.count) && h.count >= 1)) err(file, `spikeRow ${k} count must be int >= 1`);
            const horiz = dir === "left" || dir === "right";
            for (let i = 1; i < (h.count || 1); i++) tiles.push(horiz ? [h.col + i, h.row] : [h.col, h.row + i]);
        }
        if (h.type === "arrow") {
            if (!inBounds(h.col, h.row)) err(file, `arrow ${k} out of bounds`);
            if (h.side !== undefined && !oneOf(h.side, ["top", "bottom", "left", "right"])) err(file, `arrow ${k} side "${h.side}" invalid`);
        } else {
            for (const [c, r] of tiles) if (!interior(c, r)) err(file, `${h.type} tile ${c},${r} must be interior`);
        }
        if (h.type === "button") buttons++;
        for (const [c, r] of tiles) {
            const tk = `${c},${r}`;
            if (occupied.has(tk)) err(file, `two hazards on ${tk}`);
            occupied.add(tk);
        }
    }
    if (p.lock === "buttons" && buttons < 2) warn(file, `lock "buttons" with ${buttons} button(s): runtime falls back to "none"`);

    // torches / props / scatter
    for (const t of p.torches ?? []) {
        const k = `${t.col},${t.row}`;
        if (!inBounds(t.col, t.row)) err(file, `torch ${k} out of bounds`);
        if (!oneOf(t.side, ["N", "S", "E", "W", "F"])) err(file, `torch ${k} side "${t.side}" invalid`);
        if (t.type !== undefined && !oneOf(t.type, ["torch", "candlestick_1", "candlestick_2"])) err(file, `torch ${k} type "${t.type}" invalid`);
        if (t.side === "F" && !String(t.type).startsWith("candlestick")) err(file, `torch ${k} side F requires a candlestick type`);
    }
    for (const pr of p.props ?? []) {
        if (!inBounds(pr.col, pr.row)) err(file, `prop ${pr.col},${pr.row} out of bounds`);
        if (!(isInt(pr.index) && pr.index >= 0)) err(file, `prop ${pr.col},${pr.row} index must be int >= 0`);
    }
    const sp = p.scatterProps;
    if (sp !== undefined) {
        if (typeof sp.enabled !== "boolean") err(file, "scatterProps.enabled must be boolean");
        if (sp.density !== undefined && !(typeof sp.density === "number" && sp.density >= 0 && sp.density <= 1)) err(file, "scatterProps.density must be 0..1");
        if (sp.enabled && (p.props ?? []).length) warn(file, "scatterProps enabled: manual props are ignored");
    }

    if (p.heartCount !== undefined || p.heartDropChance !== undefined) warn(file, "heartCount/heartDropChance are not read from pieces (status.md #3)");
    if (!BASE_NAME_RE.test(file)) warn(file, "file name does not follow serve.py _base_name convention");

    const sig = ["N", "E", "S", "W"].map((d) => (doors[d] ? 1 : 0)).join(",");
    const key = `${type}|${sig}`;
    coverage.set(key, (coverage.get(key) || 0) + 1);
}

if (![...coverage.keys()].some((k) => k.startsWith("start|"))) warn("coverage", "no start piece");
if (![...coverage.keys()].some((k) => k.startsWith("boss|"))) warn("coverage", "no boss piece (boss cell is an empty procedural room)");

// ---------- report ----------
for (const w of warnings) console.log(`WARN  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
console.log(`\n${onDisk.length} pieces, ${listed.length} listed, ${errors.length} error(s), ${warnings.length} warning(s).`);
console.log("Coverage:", [...coverage.entries()].sort().map(([k, n]) => `${k}=${n}`).join("  "));
process.exit(errors.length || (strict && warnings.length) ? 1 : 0);
