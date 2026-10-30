import assert from 'node:assert/strict';
import { createRoom, normalizeMap, createMap } from '../js/editor2/MapModel.js';

globalThis.window = { addEventListener() {} };
const { MapEditorApp } = await import('../js/editor2/MapEditorApp.js');
const room = createRoom(8, 8);
const floor = room.tiles[3][3];
const app = {
    room, stroke: { visited: new Set() }, tool: 'paint', paintKind: 'auto',
    palette: { stamp: [[61]], hasTransparency: () => true },
    contentTools: { apply: () => false }
};
MapEditorApp.prototype._applyTool.call(app, 3, 3);
assert.equal(room.tiles[3][3], floor, 'transparent decoration must preserve the floor');
assert.deepEqual(room.props, [{ index: 61, col: 3, row: 3 }]);
app.stroke.visited.clear();
MapEditorApp.prototype._applyTool.call(app, 3, 3);
assert.equal(room.props.length, 1, 'repainting must not duplicate decoration');
let sampled;
app.palette.selectIndex = index => { sampled = index; };
app._setTool = tool => { app.tool = tool; };
MapEditorApp.prototype._eyedrop.call(app, 3, 3);
assert.equal(sampled, 61);
assert.equal(app.tool, 'paint');
assert.equal(app.paintKind, 'auto');
const map = createMap();
map.rooms['0,0'] = room;
assert.deepEqual(normalizeMap(JSON.parse(JSON.stringify(map))).rooms['0,0'].props, room.props);
app.stroke.visited.clear();
app.palette.hasTransparency = () => false;
app.palette.stamp = [[17]];
MapEditorApp.prototype._applyTool.call(app, 4, 3);
assert.equal(room.tiles[3][4], 17, 'opaque tiles still paint the floor');
console.log('Transparent tiles preserve floor, remain props after reload, and do not duplicate.');
