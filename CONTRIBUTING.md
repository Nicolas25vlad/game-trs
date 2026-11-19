# Como contribuir

Obrigado por ajudar! Este guia é curto de propósito.

## Ambiente

1. Clone o repo e abra o `index.html` no navegador. Não tem instalação nem build.
2. Para testar o celular como controle, clone o [trs-mobile-device-management](https://github.com/Traficas-Revolution-Soccer/trs-mobile-device-management) ao lado e rode `node server/server.js --game ../game-trs` dentro dele.
3. Para medir FPS e ver o que o jogo está fazendo, ligue o diagnóstico em **Configurações**.

O Node.js 18+ roda os testes, e o Python 3 gera o HTML offline e roda o e2e.

## Regras do projeto

- **Sem dependências e sem build.** JavaScript puro, carregado em ordem pelo `index.html`. O jogo também é publicado como um único HTML offline, e isso precisa continuar funcionando (`npm run build:offline`).
- **A simulação não toca no DOM.** `js/football/`, `rules.js`, `engine.js` e companhia rodam em Node nos testes.
- **O mundo é determinístico.** Nada de `Math.random` em `js/football/`: use o RNG com semente do mundo.
- **A entrada é desacoplada.** Todo dispositivo vira o mesmo comando lógico em `js/input/input.js`, e o motor nunca sabe de onde veio.
- **Siga o estilo do código ao redor:** compacto, com comentários em português explicando o *porquê*.
- **Nada de conteúdo oficial.** Sem escudos, uniformes, rostos ou músicas protegidos. Elenco novo entra com fonte em `data/fontes_elencos_2026.txt`.
- **Controle no celular** (página, servidor, pareamento, QR) é no [trs-mobile-device-management](https://github.com/Traficas-Revolution-Soccer/trs-mobile-device-management). Aqui fica só o lado do jogo.

## Testes

```bash
npm test             # tudo (~2 min)
npm run test:rapido  # sem os conjuntos lentos (~15 s)
node tests/run.cjs world input   # só os conjuntos cujo nome contém "world" ou "input"
```

Todo comportamento novo precisa de teste:
- **Física, IA, regras em campo:** `tests/world.test.cjs`.
- **Entrada:** `tests/input.test.cjs`.
- **Leis do jogo e motor estatístico:** `tests/rules.test.cjs`, `tests/montecarlo.test.cjs`.
- **Copa, Germinare, catálogo:** o teste com o nome correspondente.
- **Telas e fluxo no navegador:** `tests/e2e_test.py` (Playwright).

Mudou o equilíbrio do jogo (gols, faltas, cartões por partida)? Rode o `montecarlo.test.cjs` e conte no PR o antes e o depois.

## Commits e pull requests

- Mensagens no formato [Conventional Commits](https://www.conventionalcommits.org/pt-br/): `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `perf:`, `chore:`.
- Um assunto por pull request, com uma descrição do que mudou e de como foi testado. Mudança visual leva captura de tela.
- Atualize o [CHANGELOG.md](CHANGELOG.md) na seção **Não lançado**.

## Releases

1. Mova a seção **Não lançado** do CHANGELOG para a nova versão e atualize a versão no `package.json` e no `index.html`.
2. Crie a tag `vX.Y.Z` e publique a release no GitHub.
3. O workflow **Release** anexa o `TRS26_vX.Y.Z_OFFLINE.html` à release sozinho.
