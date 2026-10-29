# Revisão: Arauto das Brasas — visual

Revisão do autor, sem revisor externo.

- O ataque normal e o attack3 ficaram ~25–30 ticks mais curtos no estado `attack` (o tempo antes do impacto agora está no windup). O tempo total windup + ataque é o mesmo.
- `_currentFrameIndex` usa um epsilon no estado `attack` para fps fracionários (fase 2).
- O contorno é 4 `drawImage` extras por frame do golem; o buffer é reaproveitado. Sem DOM (testes em Node) o contorno é ignorado.
- A luz ocupa um `addLight` por inimigo que expõe `lightInfo()`; hoje só o Arauto.
- A estimativa de largura dos corações em `VtuberHud.freeSpan` continua sendo uma aproximação.
