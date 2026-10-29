# Seletor de inimigos do editor 2.0

## Objetivo
No painel "Conteúdo e gameplay" do editor 2.0: lista de inimigos com sprite (como no editor 1.0), só com os inimigos prontos, e destaque claro da ferramenta/opção ativa em todo o painel.

## Decisões (confirmadas com o usuário)
- Inimigos liberados: Demônio (Rápido) `demon`, Monstro de Sangue (Tanque) `bloodMonster`, Cavaleiro Negro B (Tanque) `blackKnightB`. Lista em `EDITOR2_ENEMY_KEYS`.
- Clicar num inimigo já ativa a colocação; o botão "Colocar inimigo" foi removido.
- Destaque em todo o painel, tipo de porta e linha fixa "Ferramenta ativa: X".
- Tochas e Interativos também viraram listas visuais (interativos: cor + símbolo, sem sprite no projeto).
- Inimigos fora da lista continuam desenhados e apagáveis em salas existentes. Editor 1.0 e jogo inalterados.

## Arquivos
- `js/editor2/ContentCatalog.js` (novo), `tests/test_editor2_content_catalog.js` (novo)
- `js/editor2/ContentTools.js`, `js/editor2/MapEditorApp.js`, `css/editor2.css`
- Docs: `.agents/context/systems/room-editor.md`, `.agents/context/status.md` (#22)
