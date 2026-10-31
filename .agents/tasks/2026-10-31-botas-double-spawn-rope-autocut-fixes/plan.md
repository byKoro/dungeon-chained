# botas double spawn rope autocut fixes

Status: done
Branch: feat/cage-visual-editor  Date: 2026-10-31

## Goal
Corrigir três bugs da sala botas: (1) inimigos spawnando duas vezes, (2) câmera mergulhando nos
inimigos duas vezes, (3) cordas cortando sozinhas. Causa raiz: duas zonas sobrepostas ("zona" grande
e "combate" dentro dela) em que cada zona reivindicava os MESMOS inimigos (ZoneSpawner) e as MESMAS
estacas (CageEncounter), além de o CageEncounter forçar um corte automático na entrada. Também: adicionar
um som de baque quando os inimigos caem no chão.

## Root cause (context-gatherer + leitura do mapa vivo)
- botas tem zones [zona 3,4,31×20] e [combate 16,15,16×11] (combate ⊂ zona), 6 inimigos soltos e 8 estacas `rope` com `drops`.
- ZoneSpawner criava um grupo por zona → os 6 inimigos (dentro das duas) spawnavam 2× e cada grupo rodava um mergulho de câmera.
- RoomEvents._cageList criava um CageEncounter por zona com estaca → duas encounters sobre as mesmas estacas.
- CageEncounter forçava `ropeDefs[0].auto = true` quando o autor não marcava nenhuma → a 1ª corda cortava ao entrar na zona (botas/penhasco não marcam auto).

## Steps (feitos)
- [x] 1. js/rooms/ZoneAssign.js: ownerZone/objectsOwnedByZone — cada objeto pertence à menor zona que o contém.
- [x] 2. ZoneSpawner: grupos por objectsOwnedByZone (inimigo em uma zona só).
- [x] 3. CageEncounter: estacas por objectsOwnedByZone; RoomEvents._cageList: zona precisa SER DONA de estaca. Forçar auto só em mapas legados (sem `drops`).
- [x] 4. CAGE.landSound (sawTackleLand, rate 0.82) em CageEncounter._updateJumpers e ZoneSpawner._land, por cima do enemyStep.
- [x] 5. Testes + Electron smoke + docs.

## Verificação
- npm test 61/63 (só pré-existentes arauto_effects/modular_grid). test_zone_assign 9/9, test_room_events 26/26.
- Electron (sala botas): maxEnemiesAtOnce 6 (era 12), cameraDiveStarts 1 (era 2), cutsAfterEntryHold 0 (não corta sozinho), ropesCutDuringSweep 1 (corta só quando a serra cruza a estaca). 0 erros de console.
- inicial (Salão) preserva o auto-cut (autora `auto` em 16,15; tem `drops`).

## Docs atualizados
- [x] .agents/context/systems/rooms-and-maps.md (dedupe de zona + auto-cut do cage)
- [x] .agents/context/status.md
