# Authored room pieces matched by door signature

Status: accepted (b3f1526, 6416af4, 260b8af)

Room content is hand-authored in the room editor and stored as `map/*.json` pieces listed in `map/index.json`. The procedural part only builds the dungeon graph and picks a piece whose `type|N,E,S,W` door signature matches each cell. This trades infinite variety for designed encounters. `index.json` exists because browsers cannot list directories. The socket/`ModularGrid` model is kept for the editor and tests but is not the runtime generator.
