# Review — integração main/boss

Revisão conforme code-review, com agentes Standards e Spec separados sobre o diff contra origin/main, concentrada nas resoluções de conflito.

Standards: um achado de integração resolvido; nenhum outro problema material.
Spec: um achado resolvido, o mesmo: o áudio genérico do FireSkullBoss era suprimido por isBoss. O filtro agora usa isGhostfire; testes verificam ambos os caminhos de áudio.

Ghostfire implementa takeHit para manter vida/imunidade com o combate novo e a serra lançada; hit stop local pausa seu ciclo. Efeitos e iluminação específicos ignoram os outros bosses. Factory preserva Cultist e FireSkull da main.
