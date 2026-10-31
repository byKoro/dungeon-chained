# Verification — tackle unlock

## Automated
- [x] `npm test -- saw_tackle` / `forge` / `ability_card` / `saw_upgrades`: passam, incluindo os casos novos
      (trava do tackle, Investida grátis/precisa da Serra/fora do padrão, `notify` por evento, ordem do catálogo).
- [x] `npm test`: 60/63; falham só `test_arauto_das_brasas`, `test_arauto_effects` e `test_modular_grid` (Curva SE, #5).
      `test_modular_grid` falha igual num worktree limpo do `d499dd6`; as do Arauto já estavam listadas.
- [x] `npm run check`: falha só nos itens antigos (Arauto, #4 peça não listada, #5). `validate:map` aceita a lista nova da Penhasco. Graph atualizado.
- [x] Script headless do F1 (Node, fakes): Moedas +10/+10/−10/+100 = 110 e piso em 0; Telinha muda para INVESTIDA e
      mostra o card sem liberar `tackle`, fecha o F1 e trava o dash dos dois; Bigorna da Penhasco abre com
      `tackle,saw` ignorando `canOpen`, e a da sala atual usa a bigorna real.
- [x] Harness `_local` (apagado depois) no Chrome headless rodando `TackleDemo` de verdade: serra solta em x=282,
      dash aos 1,0 s (`pressed` true), voo 282→402→537, demônio `dying` aos ~1,42 s, serra parada no alvo e de volta
      `drop@282` aos 2,3 s, loop reinicia aos 4,5 s.

## Not verified
- Visual do "vídeo": no harness os sprites (tiles, jogadores, serra) não carregaram, nem para o `DashDemo` existente,
  então é limitação do harness; ainda assim, o enquadramento, a ilha e a leitura do vídeo não foram vistos.
- Fluxo dentro do jogo: comprar na bigorna da Penhasco, forja fechando, card aparecendo, sumir no 1º tackle, morte na
  sala desfazendo a Investida, "GRÁTIS" no menu. Nada disso foi aberto no navegador/Electron.
- Menu F1 desenhado (largura 340 com os rótulos novos) e com eventos de teclado reais.
- Checkbox "Investida liberada" no Editor 2.0.
