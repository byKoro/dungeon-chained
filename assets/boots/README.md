# assets/boots
Botas aladas que flutuam sobre a bigorna da sala `botas` (concedem o dash). Pixel art feita à mão em código por `scripts/gen-boots.py` (sem geração por IA, sem asset de terceiros), seguindo uma imagem de referência do time, na paleta dos props (contorno `#25131a` dos baús/bigorna/chave, couro dos baús, ouro da chave/moeda, metal claro dos baús na asa). Para mudar: edite o script e rode `python scripts/gen-boots.py --preview` (prévia em `_local/boots-preview.png`, 16x e sobre a bigorna a 4x). Não edite o PNG à mão: o script sobrescreve.
| Arquivo | Tamanho (px de arte) | Uso |
|---|---|---|
| `boots.png` | 16×16 | par de botas em 3/4, bico para a direita, punho dobrado, fivela dourada, asa branca no calcanhar |
No jogo, 1 px de arte = 4 px de mundo (`BOOTS.artScale` em `js/config/DemoConfig.js`); o reflexo diagonal (`BootsPickup._beam`) é recortado no alfa do sprite.
