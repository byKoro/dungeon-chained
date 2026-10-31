# Trailer reformulado (~82 s, mais frenético)

Status: in progress
Branch: feat/cage-visual-editor

## Goal
Reformular o trailer de abertura no estilo da cena do Arauto (planos próximos, mordida da serra,
jogadores atacados, movimento vivo) e mostrar o caminho da demo: serra na bigorna, luta em grupo,
cordas e gaiolas, moedas, bigorna com compras, chave e portão, Arauto.

## Decisões (grilling 2026-10-31)
Ordem final:
| # | Cena | Duração | Status |
|---|---|---|---|
| 1 | Intro: a serra cai e crava na bigorna | ~12 s | Reformular (IntroScene) |
| 2 | Título sangrento | ~5 s | Manter |
| 3 | Frenzy: ataque em grupo, sem dash | ~7 s | Reformular |
| 4 | Cordas e gaiolas | ~5 s | Nova |
| 5 | Baú jorrando moedas | ~3 s | Nova |
| 6 | Bigorna: duas compras + serra dupla em luta | ~6 s | Nova |
| 7 | ZigZag com dash | ~3,5 s | Reformular |
| 8 | SnapShot | ~5 s | Reformular |
| 9 | MapGen | ~7 s | Encurtar (mesmas ondas) |
| 10 | ArrowRun | ~4 s | Acelerar; flecha acerta um |
| 11 | HoleRun com dash | ~4 s | Reformular; quase-queda salva por dash |
| 12 | Chave → portão → atravessam | ~6 s | Nova |
| 13 | Arauto + título | ~17 s | Manter |
Cortadas: SplitShot, ButtonDoorShot, GiantSawShot.
- Contador de moedas só nas cenas 3, 5, 6.
- Kit compartilhado com intensidade por nível (inimigo = pequena, boss = grande).
- Alinhamento com a música numa passada final.

## Steps
1. [x] Kit (`js/trailer/kit/fightKit.js`): mordida por nível, câmera por planos, espera viva,
   arremesso, fila de ações atrasadas. Arauto passa a usar o kit; verificar no Electron que segue igual.
2. [ ] Uma cena por vez, na ordem 1, 3, 4, 5, 6, 7, 8, 10, 11, 12, 9, com captura no Electron e
   aprovação do usuário em `?scene=N`.
   - [~] 1 Intro: feita, aguardando aprovação (`?scene=0`).
3. [ ] Passada de música.
4. [ ] Docs (notes do trailer com tabela número → cena, status.md), `npm run check`.
