# TRS26 / MATCHDAY 0.6 — Relatório técnico: testes, limitações e pendências

Data dos testes: 18/11/2026.

**Ambiente:**
- Linux, Node 22.23;
- Google Chrome 153 headless, com **WebGL por software (SwiftShader)**;
- Playwright 1.63.

**Não houve** GPU real, controle físico, celular físico, Safari/iOS nem Firefox. Tudo o que está abaixo foi executado de verdade nesse ambiente; o que não pôde ser executado está dito explicitamente.

---

## 1. Resultado dos testes automatizados (todos passando)

| Conjunto | Verificações | O que cobre |
|---|---|---|
| `world.test.cjs` | 39 | Mundo jogável sem navegador, com um "humano" enviando os mesmos comandos do teclado/controle: humano cobra a saída; passe chega a companheiro e o controle troca sozinho; movimento, diagonal, sprint, inércia, frenagem; TROCAR; chutes que às vezes viram gol e às vezes não; desarmes e recuperação de posse; lateral, escanteio, tiro de meta, gol só com a bola inteira além da linha, impedimento no momento do passe, pênalti, 2º amarelo → vermelho; intervalo e fim com duração real; determinismo por semente; replay sem avançar a partida; Germinare 5x5; disputa de pênaltis com mergulho do goleiro humano; dificuldade Iniciante × Lendária |
| `server.test.cjs` | 27 | **Servidor real** (processo Node + WebSocket de verdade): serve jogo e controle, protege o código do servidor e bloqueia travessia de diretório; PIN de 6 dígitos com expiração real; bloqueio após 5 PINs errados; nenhum comando antes da autorização; token; joystick + botões simultâneos; pacotes antigos/inválidos descartados; limite de frequência; dois celulares independentes; queda informada; reconexão com token (token falso recusado); encerramento de sessão |
| `rules.test.cjs` | 34 | Regras e relógio do motor estatístico (usado em SIMULAR) |
| `choreo.test.cjs` | ~1.000 lances | Coreografia dos lances do motor anterior (ainda usada pelos destaques simulados) |
| `montecarlo.test.cjs` | 600 partidas | Equilíbrio do motor estatístico |
| `pacing.test.cjs` | 22 | Relógio contextual da 0.5 |
| `germinare.test.cjs` | 23 | Regras 5x5 |
| `tournament.test.cjs` | 25 | Modo Copa: formatos, folgas, grupos, desempate em campo |
| `catalog.test.cjs` | 26 | Catálogo; migração 0.6 (liga genérica removida, clubes editados preservados, instalação nova sem genéricos); continentes; ligas pendentes sem elencos inventados |
| `e2e_test.py` (navegador) | 69–70 | Ver abaixo (as verificações de replay de gol e de melhores momentos do pós-jogo só ocorrem quando sai gol na partida do teste) |

**Sem verificação automática dedicada:** vantagem, carrinho, tiros livres (barreira), acréscimos, prorrogação de 2×15 no profissional, substituições durante a partida e os 12 dribles um a um estão implementados. Aparecem nas partidas dos testes e na amostra IA x IA (faltas, cartões), mas não têm uma asserção própria. A troca de titular por reserva antes da partida é verificada no e2e.

### Teste de ponta a ponta no navegador (69–70 verificações; última execução: 70, todas passando)

**A1 · Dados e identidade**
- Clube de versão antiga preservado em "Clubes personalizados".
- Capa original com JOGAR; Enter abre o menu já focado.
- A animação das 5 poses troca de pose.
- Modo Carreira indicado como conteúdo futuro.

**A2 · Partida rápida só com teclado**
- Escolha de lados → clubes → confronto no estilo PES: escalações simétricas e só os dois botões principais.
- Campo tático: um titular trocado por reserva e a formação 4-4-2 foram **usados na partida**.

**A3 · Jogar com teclado**
- J dá a saída; W/A/S/D + Shift chega a 8,9 m/s em sprint.
- Perder o foco da janela solta todas as teclas.
- Esc pausa e congela a física; câmera configurável; controles exibidos; Continuar.

**A4 · Partida completa**
- Intervalo com estatísticas; 2º tempo; apito final.
- O placar corresponde aos gols da física.
- Pós-jogo com notas e melhor jogador; quando há gol, os melhores momentos do pós-jogo reproduzem os lances gravados. (Que o replay não avança a partida é verificado em `world.test.cjs`.)

**A5 · Gamepad API** (emulada por script, ver seção 2)
- Controles Xbox e PlayStation identificados.
- Navegação de menu com analógico; A confirma; Start avança.
- Cada controle escolhe seu lado.
- **Comandos separados por dispositivo.**
- Desconexão pausa a partida com opções; reconexão retoma.
- Start pausa.
- Remapeamento de controle e de teclado; zona morta respeitada.

**A6 · Assistir, Germinare, Copa, persistência**
- ASSISTIR: IA x IA contínua até o fim.
- Germinare 5x5 jogável.
- Copa até a final: final decidida em campo, cerimônia pulável e campeão registrado.
- Histórico e clube personalizado mantidos após recarregar.

**A7 · Canvas 2D:** partida contínua sem WebGL2.

**Erros:** nenhum erro de JavaScript na parte A.

**B · Servidor local real + dois "celulares"** (ver seção 2)
- PIN na tela do computador.
- Dois celulares pareados e autorizados.
- Viram CELULAR 1 e CELULAR 2; cada um escolhe o lado com o próprio joystick.
- Partida com os dois.
- **Multitoque:** analógico segurado + PASSE chegam juntos ao jogo.
- O PASSE do celular dá a saída; o joystick move o atleta e soltar zera o comando.
- Latência medida.
- O celular 2 cai → partida pausada e comandos dele zerados; o celular 1 segue conectado.
- Nenhum erro de JavaScript.

O teste avança algumas partidas chamando o **mesmo laço da tela** (`MD.Play.frame`) com o desenho 3D desligado, porque a GPU por software é lenta. A renderização real foi verificada nas capturas (`docs/capturas/`).

### Amostra IA x IA (6 partidas de 10 min reais, dificuldade Profissional, mundo contínuo)

| Jogo | Placar | Finalizações | Acerto de passes | Faltas | Amarelos | Escanteios | Impedimentos | Bola em jogo |
|---|---|---|---|---|---|---|---|---|
| FLA x PAL | 2-2 | 11+7 | 61% / 57% | 3 | 0 | 2 | 6 | 68% |
| COR x SAO | 2-2 | 8+3 | 72% / 57% | 9 | 2 | 1 | 6 | 71% |
| GRE x BAH | 3-0 | 7+4 | 63% / 63% | 9 | 4 | 1 | 5 | 72% |
| BOT x FLU | 0-2 | 6+6 | 57% / 58% | 4 | 1 | 3 | 2 | 69% |
| CRU x INT | 3-1 | 8+8 | 55% / 67% | 6 | 0 | 2 | 5 | 67% |
| SAN x FOR | 0-1 | 11+1 | 70% / 61% | 4 | 0 | 2 | 1 | 76% |

- **Média:** 3,0 gols por jogo.
- **Pênaltis:** conversão medida de ~82% nos testes.
- **Determinismo:** a mesma semente gera o mesmo placar.

O acerto de passes (55–72%) está **abaixo** do futebol real (~80%), e há impedimentos demais. São pontos de ajuste da IA (seção 5).

---

## 2. O que NÃO foi testado (e como foi substituído, quando foi)

- **Controles físicos:** **nenhum** controle real foi conectado. A Gamepad API foi **emulada** por script (objetos `Gamepad` falsos com os IDs de Xbox e DualSense). Isso valida a lógica (detecção, mapeamento, separação, desconexão), não o hardware, os drivers ou a vibração real.
- **Celulares reais:** **nenhum** celular físico foi usado. Os "celulares" do teste B são **páginas móveis do Chrome** (tela 844×390, toque ativado) na mesma máquina, falando com o **servidor real** por WebSocket real. O multitoque foi gerado com eventos de toque do Chrome (CDP `Input.dispatchTouchEvent`).

  Não foram testados:
  - Wi-Fi real;
  - outro aparelho na rede;
  - iOS/Safari;
  - a vibração;
  - a tela cheia e o travamento de orientação;
  - a latência em rede real (o valor medido é local: 0–2 ms).
- **Conexão pela internet (WebRTC):** **não implementada.** O celular precisa estar na mesma rede local do computador.
- **Desempenho / FPS:** **não medido** em GPU real. Com WebGL por software o jogo fica correto, mas lento, e esse número não representa um computador normal. Não declaro nenhum valor de FPS. O jogo tem um modo de diagnóstico (Configurações) que mostra o FPS na sua máquina.
- **Navegadores:** só Chrome. Edge (mesmo motor) deve funcionar; Firefox e Safari não foram testados.
- **Áudio:** gerado por WebAudio; verifiquei apenas que não há erros, não ouvi.
- **Fontes Anton e Russo One:** sem rede no ambiente, usadas apenas se instaladas no sistema. Nas capturas aparecem as fontes substitutas.

---

## 3. Implementado, parcial e não implementado

### Implementado
- **Mundo jogável único** para JOGAR, ASSISTIR e MELHORES MOMENTOS, com passo fixo e interpolação.
- **Física e ações:**
  - física da bola, traves e rede;
  - passes de todos os tipos, chutes com força, cabeceio, 12 dribles;
  - desarme, carrinho, pressão, troca de jogador e goleiro controlável na saída.
- **Regras completas em tempo real:** reinícios visíveis e cobrados por humanos, cartões, substituições, prorrogação e disputa de pênaltis.
- **IA:** ofensiva e defensiva contínua, cinco níveis de dificuldade e goleiros com defesa planejada.
- **Duração real configurável** (4 a 90 min).
- **HUD completo**, oito câmeras com zoom e altura, replay, pausa, intervalo e pós-jogo.
- **Teclado:** dois teclados lógicos, remapeável, sem teclas presas.
- **Gamepad API completa:** remapeamento, zona morta, sensibilidade, inversão, vibração, ícones e assistências.
- **Multiplayer local** e co-op no mesmo lado.
- **Controle virtual no celular** com servidor local real: PIN, autorização, token, limites e reconexão, para até 4 controles.
- **Telas TRS26:**
  - capa e logotipo originais, 5 poses;
  - lados, confronto 3D com dois atletas, editor tático;
  - tela de controles e tela do celular.
- **Catálogo:**
  - continentes e favoritos;
  - liga genérica removida sem apagar nada do usuário.
- **Modos preservados:**
  - Germinare jogável;
  - Copa com partidas jogáveis;
  - editores, estúdio de uniformes, importação e exportação.
- **Arquivo único** offline.

### Parcial
- **Elencos internacionais:** as 17 ligas estão **listadas como pendentes, sem clubes**. Não inventei jogadores; os elencos reais de 2026 precisam ser pesquisados e cadastrados (ou criados pelo usuário).
- **Personalidade:** influencia comemorações e escolha do capitão. Reações a faltas e a chances perdidas ainda são genéricas.
- **Ajuste fino da IA:** acerto de passes abaixo do real e impedimentos frequentes (medidos na amostra acima).
- **Animações:** as dos atletas reaproveitam o esqueleto da 0.5. Transições entre corrida, chute e drible são funcionais, mas não têm captura de movimento.
- **SIMULAR (Copa):** continua usando o motor estatístico rápido da 0.5, por velocidade. JOGAR, ASSISTIR e MELHORES MOMENTOS usam o mundo contínuo.

### Não implementado
- **Modo Carreira e Modo História:** marcados "EM BREVE" no menu.
- **Conexão de celular pela internet** (WebRTC ou servidor de sinalização).
- **QR code** para abrir o controle no celular: o endereço é mostrado em texto.
- **Estádios reais, rostos reais, escudos e uniformes oficiais:** não usados, por direitos.

---

## 4. Arquivos criados e modificados

**Criados:**
- `js/football/world.js`, `js/football/ai.js`;
- `js/input/input.js`, `js/input/remote.js`;
- `js/ui/play.js`, `js/ui/tactics.js`, `js/ui/trs.js`;
- `css/trs26.css`, `assets/branding/*` (arquivos do TRS26 enviados);
- `server/server.js`, `server/package.json`;
- `controller/index.html`, `controller/controller.css`, `controller/controller.js`;
- `tests/world.test.cjs`, `tests/server.test.cjs`, `tests/e2e_test.py` (reescrito).

**Modificados:**
- `index.html`: novas telas e scripts;
- `js/gfx/renderer3d.js`: `renderLive`, `project`, `renderVersus`, contexto com transparência;
- `js/gfx/renderer2d.js`: mesmas funções no Canvas 2D;
- `js/gfx/camera.js`: câmeras Ampla e Atrás do jogador, zoom e altura;
- `js/kit.js`: escolha manual de uniformes;
- `js/audio.js`: sons de interface;
- `js/data.js` e `js/catalog.js`: continentes, ligas pendentes, favoritos, migração 0.6, instalação nova;
- `js/ui/app.js`: fluxo para o confronto, filtros;
- `js/ui/boot.js`: laço com entrada, capa inicial;
- `js/ui/copa.js`: time do usuário, JOGAR, ASSISTIR, MELHORES MOMENTOS, SIMULAR;
- `js/ui/germinare_ui.js`: escolha de lados;
- `js/tournament.js`: resultado vindo do mundo;
- `tests/load.cjs`, `tests/catalog.test.cjs`;
- `tools/build_standalone.py`.

---

## 5. Problemas corrigidos durante os testes

**Física e IA**
- Laços de lateral (a bola era posta fora da linha).
- Chutes precisos e rápidos demais.
- Excesso de faltas.
- Reinícios demorados.
- Lançamentos saindo pela linha de fundo.
- Escanteios raros.
- Passe da saída indo para frente.

**Goleiro e pênaltis**
- Goleiro indo ao gol errado na disputa de pênaltis.
- Defesa de pênalti sem efeito.
- Conversão de 100%.
- Relógio correndo durante os pênaltis (repetia o fim de período).

**Determinismo:** `Math.random` na saída de bola.

**Configurações:** troca automática de jogador ignorando a configuração.

**Entrada**
- Esc perdido entre quadros.
- Controle Xbox identificado como PlayStation.
- Enter duplicado ao entrar na escolha de lados.
- Esc da escolha de lados avançando em vez de voltar.
- Multiplayer começando com o teclado na frente dos controles.

**Celular**
- Campo de PIN bloqueado pelo `pattern` com espaço: o pareamento não saía do celular.
- Estado zerado quando a janela perdia o foco.
- Envio dependente do `requestAnimationFrame`, que pode ser desacelerado pelo navegador; agora o envio sai no próprio evento de toque.
- Tolerância de pacote antigo de 350 ms para 800 ms.

**Catálogo e interface**
- Instalação nova mostrava aviso de migração de clubes genéricos que nunca existiram.
- Fontes com 404 (agora só `local()`).
- Pedalada sem atalho no teclado.

---

## 6. Próximos passos sugeridos

1. Testar em GPU real e em celulares e controles físicos; medir FPS com o diagnóstico e ajustar a qualidade.
2. Pesquisar e cadastrar os elencos 2026 das ligas internacionais, com fontes.
3. Calibrar a IA: acerto de passes e impedimentos.
4. Adicionar QR code e, se desejado, conexão pela internet (WebRTC com servidor de sinalização).
5. Ampliar reações por personalidade e animações de transição.
6. Implementar o Modo Carreira e o Modo História.
