# Changelog

Todas as mudanças relevantes do jogo ficam aqui.
O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto usa [Versionamento Semântico](https://semver.org/lang/pt-BR/) a partir da 0.7.0.

## [Não lançado]

### Engine (fase 2)
- **Passe calculado pela física da bola.** A força do passe rasteiro sai da fórmula exata da rolagem (atrito 2,35 + 0,035·v) e a do passe alto vem do voo simulado com arrasto e efeito: a bola cai a menos de 25 cm do alvo. Passes longos chegam mais firmes. A antecipação do receptor usa o tempo real de voo.
- **Barra de força decide a firmeza com que a bola chega**, não a velocidade de saída: um toque curto não deixa mais o passe fraco e sem alcançar o companheiro.
- **Tempo de reação ao passe:** logo depois do passe (0,12 a 0,24 s, pela agilidade), só o receptor ou quem está com o corpo no caminho toca na bola. Antes, qualquer adversário a ~0,8 m ficava com ela na hora. Chutes continuam podendo ser bloqueados: quem marca antecipa.
- **Disputa pelo domínio** considera quem está mais perto da bola e de frente para ela, além de força e equilíbrio.
- **Recepção assistida:** sem direcional, o jogador humano que vai receber o passe corre de encontro à bola (antes ficava parado).
- **Assistência de passe do humano** evita linhas de passe bloqueadas, com o mesmo cálculo de risco da IA.
- **IA estima a interceptação com o modelo de voo do passe**, em vez de uma velocidade fixa.
- **Cada partida tem o próprio campo e as próprias regras**, em vez de apontar para o objeto global que outro jogo podia trocar.
- `world.js` dividido em `world.js` (núcleo), `physics.js`, `actions.js`, `referee.js` e `restarts.js`, sem ES modules. A divisão foi conferida bit a bit em 5 partidas completas.
- Em 24 partidas de IA x IA: acerto de passes de 60,6% para 69,3%, impedimentos de 3,5 para 1,0 por jogo, passes em profundidade certos de 33% para 90%. Gols iguais (3,5). A IA passa menos (92 contra 110 por jogo), o que fica para a calibração da fase 3. A simulação custa ~24% a mais (193 µs por passo, 1,2% de um quadro).

### Corrigido
- **Saída de bola fora da regra:** o centroavante adversário começava a 1,3 m da bola e, antes do chute, a IA andava para dentro do campo de quem dava a saída. Agora cada um fica no próprio campo e quem não dá a saída fica fora do círculo central (9,15 m; 3 m no Germinare).
- **IA passava para quem já estava impedido** quando ele estava "fazendo uma corrida": olhava o alvo do passe, não a posição do receptor na hora do passe. Passes em profundidade que viravam impedimento caíram de 30% para quase nenhum.
- **Bola atravessava a trave e o travessão.** A colisão só era vista se a bola parasse a menos de 17 cm antes do centro da trave, e acima de ~10 m/s ela pulava essa faixa num passo: a 29 m/s, 38 de 60 chutes no meio da trave atravessavam. Agora a bola anda em subpassos de no máximo 8 cm.
- **Atletas atravessavam uns aos outros.** Agora têm corpo (raio de 0,3 m): o choque é inelástico e quem tem mais força e equilíbrio (ou está protegendo a bola) cede menos.
- **Gol decidido pela posição errada:** a regra usava onde a bola estava no fim do passo, não onde cruzou a linha. Uma bola rápida que entrava rente à trave podia ser tiro de meta.

### Alterado
- **Efeito na bola segue a força de Magnus:** a curva cresce com a velocidade (bola lenta curva menos) e não cria velocidade. Chute forte ganha topspin (cai), cavadinha ganha backspin (flutua), e a mira já conta com isso.
- **Correr de lado ou de costas é mais lento** (~85% e 58% da velocidade máxima). Quem precisa correr forte para longe de onde está olhando vira e corre.
- **IA e goleiro preveem a bola com a mesma física do jogo** (arrasto, efeito e quique), em vez de uma conta própria e simplificada.
- Constantes de física reunidas em `MD.World.PHYS`, com unidades.
- Em 8 partidas de IA x IA (10 min, mesmas sementes): gols por jogo de 3,6 para 2,8, bolas na trave de 0,6 para 0,8, atletas sobrepostos de 0,09 para 0. O acerto de passes foi de 64% para 61%; o modelo de passe é o próximo passo.

### Adicionado
- `tests/physics.test.cjs`: queda livre, rolagem contra o modelo analítico, curva, topspin, trave e travessão de 10 a 35 m/s em todas as fases de chegada, linha do gol, corpos, velocidade de costas, voo dos passes e determinismo.
- `tests/engine.test.cjs`: partidas isoladas, reação ao passe, saída de bola dentro da regra e recepção assistida.

## [0.7.0] - 2026-11-19 — Controle no celular separado

O controle no celular virou um repositório próprio, lançado junto na mesma versão: [trs-mobile-device-management v0.7.0](https://github.com/Traficas-Revolution-Soccer/trs-mobile-device-management/releases/tag/v0.7.0).

- **Controle no celular mudou de repo:** a página do celular (`controller/`), o servidor de pareamento (`server/server.js`), o cliente do jogo (`js/input/remote.js`) e o teste do servidor agora vivem em [trs-mobile-device-management](https://github.com/Traficas-Revolution-Soccer/trs-mobile-device-management). O jogo carrega `mobile/qr.js` e `mobile/remote.js`, servidos por lá. Para jogar com o celular: `node server/server.js --game ../game-trs` dentro daquele repo.
- **QR code** na tela Controle virtual: o celular lê o código e já entra com o PIN, sem digitar. Com várias redes no PC, dá para escolher qual endereço vai no QR.
- **Toque curto no celular não se perde:** `js/input/input.js` guarda os botões vistos apertados entre duas leituras, como o teclado já fazia. Antes, apertar e soltar entre dois quadros (pacotes agrupados pelo Wi-Fi) sumia. Teste novo: `tests/input.test.cjs`.
- `tools/build_standalone.py` deixa os scripts de `mobile/` fora do HTML offline, que agora se chama `TRS26_OFFLINE.html`.
- **Repositório organizado:** README completo, `package.json` com `npm test` e `npm run test:rapido`, integração contínua, HTML offline anexado a cada release, modelos de issue e pull request, guias de contribuição e de segurança. O relatório de testes foi para `docs/LIMITACOES_E_TESTES.md`.

## [0.6.0] - 2026-11-18 — TRS26 · Complete Football Experience

### Mundo jogável (novo núcleo)
- `js/football/world.js`: simulação única e autoritativa, passo fixo de 1/60 s, interpolação na renderização, RNG com semente (sem `Math.random` no mundo) e resultados reproduzíveis.
- **Física da bola:** gravidade, arrasto, rolamento, quique, efeito (curva), colisão com traves e travessão, rede. O gol só vale com a bola inteira além da linha.
- **Movimento dos atletas:** aceleração e frenagem por atributos e fôlego, raio de giro, condução com toques e arrancadas.
- **Ações padronizadas** para humano e IA:
  - passes rasteiro, em profundidade, alto, cruzamento e longo;
  - chutes normal, colocado, rasteiro e cavadinha, com barra de força e modelo de erro;
  - cabeceio, desarme, carrinho, proteção e troca de jogador;
  - 12 dribles (corte, pedalada, finta, giro, elástico, caneta, chapéu, lambreta, puxada, finta de chute, arrancada, toque curto);
  - goleiro: defesa, espalmada, saída e reposição.
- **Regras em tempo real:**
  - lateral, escanteio, tiro de meta, impedimento (posição registrada no momento do passe);
  - falta com vantagem, cartões (incluindo 2º amarelo e vermelho por chance clara), pênalti, tiros livres direto e indireto;
  - acréscimos, intervalo, prorrogação (ou gol de ouro no Germinare) e disputa de pênaltis completa em campo;
  - substituições (limite configurável).
- **Reinícios visíveis:** cobrador designado, barreira e posicionamento; o humano cobra quando é a vez do time dele.
- **Durações reais** de 4, 6, 10, 15, 20, 45 e 90 min, com relógio de 90' proporcional.
- **Replay** com buffer circular de 14 s, que não avança a partida.

### IA (`js/football/ai.js`)
- Táticas a 5 Hz (linha, compactação, largura, pressionador, cobertura, marcadores) e decisões individuais a 10 Hz escalonadas.
- Carregador com decisão por utilidade (passe, chute, drible, condução) e risco de linha de passe; interceptação pela trajetória prevista.
- Goleiro com posicionamento, alcance e defesa planejada; saídas em cruzamentos e reposição.
- Bola parada e barreira; comemorações pela personalidade.
- Dificuldades Iniciante, Amador, Profissional, Craque e Lendário: mudam ruído de decisão, reação, posicionamento, execução e pressão, não a velocidade.

### Entrada
- `js/input/input.js`: teclado (dois teclados lógicos), Gamepad API (Xbox, PlayStation, genérico; conectar e desconectar, remapeamento, zona morta, sensibilidade, inversão, vibração, ícones) e celular, tudo convertido no mesmo comando lógico. Movimento relativo à câmera.
- Toques rápidos não se perdem; ao perder o foco, todas as teclas são soltas. Navegação espacial dos menus por teclado e controle.
- Tela **Controles** com remapeamento, restauração do padrão e assistências (passe, chute, troca automática).
- **Multiplayer local** com separação estrita de comandos por dispositivo; co-op no mesmo lado; pausa quando um dispositivo cai, com opção de substituir por outro ou pela IA.

### Controle virtual no celular
- `server/server.js` (Node 18+, sem dependências): serve o jogo e o site do controle.
- WebSocket (RFC 6455) com PIN de 6 dígitos com validade, bloqueio por tentativas, autorização no computador, token por celular, validação e numeração de pacotes, limite de frequência, reconexão e limpeza de sessões.
- `controller/`: joystick e botões com multitoque real (Pointer Events + captura de ponteiro), rótulos de ataque e defesa, vibração e personalização (tamanho, transparência, zona morta, sensibilidade, canhoto, direcional digital). O envio sai no próprio evento de toque.

### Telas TRS26
- Capa e logotipo originais; menu com a animação das 5 poses em transição suave (crossfade); Carreira e História marcados "EM BREVE".
- Escolha de lados MANDANTE | NEUTRO | VISITANTE com cartões de dispositivo.
- Confronto pré-jogo: dois atletas em 3D em estúdio, escudos, competição, escalações simétricas, botões JOGAR e ESCALAÇÃO E TÁTICAS.
- Editor tático com campo visual, reservas, formação, instruções, capitão, cobradores e uniforme.
- Partida em tela cheia: HUD com placar, relógio, escudos, atleta controlado, barra de força, fôlego e minimapa. Também pausa, intervalo, tela de desconexão, pós-jogo com notas e melhores momentos, e cerimônia do campeão.
- Novas câmeras **Ampla** e **Atrás do jogador**, com zoom e altura.
- Identidade TRS26 (vermelho, dourado, preto, faixas diagonais) aplicada a todas as telas (`css/trs26.css`).

### Catálogo
- Continentes e 17 ligas internacionais listadas como **pendentes** (sem elencos inventados); filtros por continente e favoritos.
- A liga genérica saiu do catálogo:
  - clubes genéricos não editados vão para um backup no navegador;
  - clubes editados e criados vão para "Clubes personalizados";
  - instalação nova não cria clubes genéricos.

### Modos preservados
- **Germinare** 5x5 agora jogável ou assistível no mundo contínuo.
- **Modo Copa:** escolha do seu time, JOGAR, ASSISTIR, MELHORES MOMENTOS ou SIMULAR; o resultado do mundo entra na chave.
- Editores, estúdio de uniformes, importação e exportação mantidos.

### Correções relevantes durante o desenvolvimento
- **Laterais e restarts:** laterais em laço (bola posicionada fora da linha); reinícios longos demais.
- **Chutes e IA:** chutes precisos e rápidos demais; excesso de faltas.
- **Goleiro e pênaltis:** goleiro indo ao gol errado na disputa de pênaltis; defesas de pênalti sem efeito.
- **Relógio e determinismo:** relógio correndo durante os pênaltis; não determinismo na saída de bola.
- **Entrada:**
  - Esc perdido entre quadros;
  - controle Xbox identificado como PlayStation;
  - Enter duplicado ao entrar na escolha de lados;
  - campo de PIN do celular bloqueado por `pattern` com espaço;
  - estado do celular zerado ao perder o foco da janela;
  - envio do celular dependente de `requestAnimationFrame`.

### Arquivo único
- `tools/build_standalone.py` gera `TRS26_v0.6_OFFLINE.html` com CSS, scripts e imagens embutidos.

## [0.5.0] — Germinare & World Cup Update

### Ritmo da partida (P1)
- **Relógio contextual** (`js/pacing.js`): entre os lances corre acelerado, perto de um lance desacelera de forma contínua até 1x e, durante o lance, segue a trilha 3D. O instante decisivo coincide com o minuto calculado pelo motor, sem saltos e sem contagem dupla.
- **Ritmos** Lento, Normal e Rápido e aceleração 1x/2x/3x, que muda só o tempo entre os lances.
- **Agendador de melhores momentos:** fila, classificação por importância (gols, pênaltis, expulsões e gols anulados sempre aparecem), filtro de lances parecidos em sequência e intervalo mínimo entre destaques (~8–15 s reais, conforme o ritmo). Os lances não exibidos têm o efeito aplicado em silêncio quando o relógio passa por eles.
- **Lances mais objetivos:** cada cena começa quando a bola chega ao campo de ataque (corte das longas trocas de passe no meio). Nenhum lance é forçado a terminar em chute ou gol.
- **IA:** passes seguros guiados pela visão; papéis por quadro (pressão, cobertura, apoio); goleiro decide entre segurar e espalmar e sai nos cruzamentos; finalização com pressão e ângulo. A média de gols ficou calibrada em ~2,7 por jogo.
- **Prorrogação e pênaltis** no mata-mata, com placar de pênaltis no ar.

### Cinemática (P2)
- **Apresentação pré-jogo** (`js/cinema.js`) em capítulos: estádio, entrada em duas filas com a arbitragem, hino, cumprimentos, sorteio, posicionamento.
- **Hino:** tema **original** sintetizado ou arquivo enviado pelo usuário; nenhuma gravação comercial.
- **Pular:** botão PULAR APRESENTAÇÃO, tecla Enter e opção nas Configurações e no pré-jogo.
- **Toque inicial** em 0:00, no 2º tempo, nos tempos da prorrogação e depois de cada gol.
- **Final:** apresentação especial. Depois dela vem a **cerimônia do campeão** (pódio, troféu original, capitão erguendo a taça, confete, música própria).

### Germinare (P3)
- **Campo da escola** em 3D (`js/gfx/germinare3d.js`), com proporções aproximadas e editáveis. A **arquibancada de madeira** é um componente separado (`js/gfx/bleacher.js`). Público de alunos genéricos, sem rostos reconhecíveis.
- **Regras:** 5x5, 5 min ou 2 gols, empate permitido, sem impedimento; lateral e pênaltis configuráveis; desempate do torneio por pênaltis ou gol de ouro.
- **Montagem dos times:** seleção livre de jogadores de qualquer clube, com filtros, cards, prévia 3D, formações, bloqueio de repetidos, seleções salvas e sorteio.
- **IA e jogadas** próprias de quadra pequena.

### Modo Copa (P4)
- **Formatos:** mata-mata de qualquer tamanho (fase preliminar com folgas) e grupos + mata-mata, com sorteio livre ou com cabeças de chave.
- **Navegação:** chaveamento navegável com o caminho até a final, tabelas, lista de jogos, artilharia e notas.
- **Partidas:** assistir, simular uma partida ou simular a rodada.
- **Persistência:** histórico de campeões, galeria de troféus e retomada após fechar o navegador.

### Clubes e interface (P5)
- **Catálogo** País → Liga → Clube, com 40 clubes (34 reais com elenco 2026 pesquisado e fonte registrada, mais 6 fictícios). Atributos sinalizados como estimativa; elencos parciais marcados.
- **Dados padrão separados das edições do usuário** (overrides por clube) e "restaurar padrão". Ligas personalizadas e mudança de liga.
- **Interface:** novo menu por modos, navegação inferior no celular, novas câmeras (Dinâmica, Próxima, Atrás do gol), pós-jogo com eficiência, passes e card do jogador da partida.
- **Personalidade:** influencia comemorações, comportamento no hino e escolha do capitão.
- **Áudio:** ambiente escolar, música do campeão, volume de música separado.
- **Canvas 2D:** passa a desenhar a geometria de cada modo, incluindo o campo do Germinare.

### Correções feitas durante os testes da 0.5
- **Migração:** salvamentos da 0.3/0.4 com **um único clube** eram ignorados e voltavam aos clubes padrão. Agora são preservados.
- **Clubes clássicos:** a migração classificava um dos 6 clubes clássicos como "Meus clubes" (ids `club-0…5`). Agora todos vão para a Liga MATCHDAY.
- **Gol de ouro:** com prorrogação também ligada, o gol de ouro não era criado. Corrigido.
- **Mata-mata:** um jogo sem a opção explícita de pênaltis podia terminar empatado. Agora todo mata-mata termina com vencedor decidido em campo.

## [0.4.0]

### Bugs da 0.3 corrigidos
- **Falta dentro da área sem consequência:** agora toda infração direta da defesa dentro da própria área vira pênalti, com sequência completa: apito, árbitro apontando a marca, reclamações, cena da cobrança, goleiro, desfecho e rebote. Antes, a "falta" era só uma animação sem regra.
- **Replay que inventava o lance:** a 0.3 desenhava sempre a mesma jogada genérica, com só o final mudando. Agora o motor gera o roteiro real do lance (quem passou, quem driblou, quem chutou e onde) e o 3D apenas o encena.
- **Travamentos:** a 0.3 reconstruía toda a geometria em JavaScript a cada quadro (~43 mil vértices, 11,6 ms) e só redesenhava a cada 85 ms. A 0.4 usa instanciamento, buffers pré-alocados e ~17 draw calls, com 0,6–2,3 ms de CPU por quadro.
- **Gol contado antes de acontecer na tela:** placar e estatísticas agora mudam no instante exato do lance; antes, no tempo fixo de 6,7 s.
- **Letreiro "BARUERI":** removido das arquibancadas.
- **Expressão escolhida à mão:** removida. Expressões automáticas por emoção, com prévia no editor.

### Simulação e regras (novo `engine.js` + `rules.js`)
- O relógio ao vivo foi preservado: 0:00, acréscimos calculados pelas interrupções, intervalo, 2º tempo a partir de 45:00 e fim após 90 + acréscimos.
- **22 atributos por jogador** (velocidade, aceleração, finalização, passe, visão, drible, controle, força, resistência, marcação, desarme, posicionamento, cabeceio, impulsão, agilidade, equilíbrio, frieza, agressividade e quatro de goleiro). O overall vem dos atributos com pesos por posição. O overall do time continua sendo a média dos 11 titulares.
- **Táticas:** cinco formações, mentalidade, pressão, estilo, marcação (zona ou individual) e amplitude. A mentalidade muda com o placar.
- Fadiga, substituições automáticas e manuais (no intervalo), forma do dia, fator casa, rigor do árbitro e semente reproduzível.
- **Jogadas:** contra-ataques rápidos e trabalhados, tabelinha, passe em profundidade, lançamento, cruzamento alto e rasteiro, linha de fundo, infiltração, jogada individual, inversão, chute de fora, escanteio, jogada ensaiada e falta direta com barreira.
- **15 dribles:** caneta, chapéu, lambreta, pedalada, corte seco, finta de corpo, giro, elástico, drible curto, mudança de direção, toque por cima, drible de velocidade, puxada, corte para dentro e finta de chute.
- **Ações defensivas:** desarme em pé, carrinho, interceptação, bloqueio de chute e de cruzamento, disputa aérea, corte de cabeça, ombro a ombro e faltas por contato.
- **Finalizações:** chute colocado, forte, rasteiro, de primeira, voleio, bicicleta, cavadinha, cabeceio e cobrança de falta.
- **Desfechos:** gol, defesa (encaixe, espalmada, ponta dos dedos, com os pés), para fora, por cima, trave, travessão, bloqueio, rebote, frango e gol contra.
- **Regras:** falta direta e indireta, pênalti, impedimento com assistente e bandeira, amarelo, segundo amarelo, vermelho direto, DOGSO e SPA, lei da vantagem, escanteio, tiro de meta, lateral, gol anulado e expulsão (o time segue com 10).
- **Calibração por simulação em massa:** ~2,7 gols, 22,6 finalizações, 25,7 faltas, 3,8 amarelos, 0,11 vermelho e 0,30 pênalti por jogo. O favorito vence mais, mas zebras acontecem.

### Coreografia, animação e câmeras
- Trilhas pré-calculadas a 30 fps para 25 personagens e a bola, com interpolação visual. Waypoints usam curvas Hermite, há separação entre jogadores e IA de posicionamento (bloco, linha defensiva, pressão, desmarcação, goleiro posicionado).
- 100 clipes de animação com transições suaves e espelhamento para canhotos: locomoção (parado e respirando, caminhada, corrida, arrancada, inclinação em curvas), passes, chutes, cabeceios, bicicleta, voleio, carrinho, quedas, levantar, dribles, goleiro (prontidão, saída, mergulhos, encaixe, espalmada, pés, reposição), árbitro (apito, cartão, pênalti, vantagem), assistentes (bandeira) e comemorações.
- **Expressões automáticas:** neutro, concentrado, feliz, muito feliz, eufórico, triste, frustrado, raivoso, surpreso, preocupado, cansado, dor e vergonha. Controlam sobrancelhas, pálpebras, boca, dentes e postura, com piscadas.
- **Comemorações:** 16 estilos, escolhidos pela personalidade do jogador e pela importância do gol. Companheiros chegam e abraçam; adversários lamentam. Câmeras de TV, acompanhando o artilheiro, da bandeirinha, close no rosto e plano aberto.
- **Diretor de câmera:** câmera principal de TV, lateral baixa, atrás do gol, pênalti, falta, escanteio, árbitro e aérea. Replay automático em câmera lenta com outro ângulo, e limites que impedem atravessar o cenário.

### 3D, personagens e estádio
- Renderizador reescrito com instanciamento, atlas de texturas, frustum culling, três níveis de detalhe, sombras simples, resolução dinâmica e qualidade Baixa/Média/Alta/Automática, além de painel de diagnóstico.
- **Personagem articulado:** cabeça em seis formatos, olhos com íris, pupila e brilho, pálpebras, sobrancelhas, nariz, orelhas, boca animável, mãos com polegar, joelhos, chuteiras com sola e uniforme texturizado com número e nome.
- **Arena:** anel inferior e superior, cobertura treliçada, torres azuis, refletores, placas de LED rolando, dois telões com placar e "GOL!", bancos, túnel e área técnica. Também redes que se deformam no gol, bandeirinhas, torcida em sprites (até 6.500) com mosaicos, bandeirões e bandeiras animados, confete, fogos e flash de iluminação.

### Personalização
- **Criador de jogador:**
  - 21 cabelos, com cor e volume; 10 barbas, com cor separada.
  - Rosto: formato, tamanho e largura da cabeça, mandíbula, queixo, nariz, orelhas, olhos e sobrancelhas.
  - Corpo em 7 estilos (incluindo estrela e esponja), com altura, ombros, tronco, barriga, braços, antebraços, mãos, pernas e pés.
  - Faixa de cabelo, munhequeiras, mangas térmicas e chuteiras em duas cores com numeração.
  - Personalidade, pé preferido, 22 atributos e ajuste por overall.
  - 9 predefinições; prévia 3D em 360° com zoom, prévia de expressões e de animações.
- **Estúdio de uniformes:**
  - 1º, 2º, 3º uniforme e de goleiro.
  - 16 estampas e 6 golas; mangas curtas ou compridas; detalhes em ombros, laterais e mangas; punhos.
  - Fontes e cor da numeração; nome nas costas; escudo; costuras.
  - Calção e meião separados.
  - **Até 5 patrocinadores** (frente, costas, mangas ou calção), com posição, tamanho, rotação, transparência, camadas e remoção.
  - **Pintura sobre a textura:** pincel, borracha, linha, retângulo, elipse, balde e conta-gotas; desfazer, refazer e limpar; guias do molde.
  - **Importação de moldes:** região, escala, posição, rotação, recorte e transparência.
  - Visualizador 3D com frente, costas, laterais, detalhe e foco na camisa, calção ou meião.
- Escolha automática do uniforme visitante quando há conflito de cores. Árbitro com uniforme contrastante.

### Interface
- Nova identidade visual com menu principal, seleção com escudos grandes, kits e comparação, e pré-jogo com escalação em campo, táticas e destaques.
- Transmissão com placar estilo TV (escudos, siglas, relógio, tempo e acréscimos), tarjas de jogador (número, foto, overall, gol, assistência, cartão), rótulos de lance e feed lance a lance com estatísticas e escalações ao vivo (energia, cartões, gols).
- Intervalo com resumo, substituições e táticas. Pós-jogo com artilheiros, estatísticas, xG, jogador da partida, notas e melhores momentos para rever.
- Configurações de gráficos, áudio, simulação e dados.
- Layout responsivo para celular.
- **Áudio sintetizado:** chute, passe, cabeceio, apito curto, longo e final, gol, rede, defesa, trave, "uh!" da torcida, cartão e ambiente com volume pela empolgação. Controles independentes e opção de silenciar.

### Dados
- Migração automática da 0.3 (cópia preservada) e IndexedDB para imagens.
- Exportação e importação individual ou de todos os clubes, com validação de formatos e tamanhos.

### Arquivos
- **Criados:** `js/util.js`, `js/data.js`, `js/rules.js`, `js/engine.js`, `js/choreo.js`, `js/audio.js`, todo o `js/gfx/` e `js/ui/`, `tests/*.cjs`, `tests/e2e_test.py`, `tools/build_standalone.py`, `docs/*.png`, `CHANGELOG.md`.
- **Reescritos:** `index.html`, `styles.css`, `README.md`; `kit.js` foi movido para `js/kit.js` e expandido; `renderer.js` e `webgl.js` foram substituídos por `js/gfx/renderer2d.js` e `js/gfx/renderer3d.js`. `app.js` foi dividido em `js/ui/*`.
- **Removidos:** testes da 0.3 (`tests/webgl_mock.test.cjs` e `tests/live_flow_test.py`), substituídos pelos novos, e as capturas da 0.3.

[Não lançado]: https://github.com/Traficas-Revolution-Soccer/game-trs/compare/v0.7.0...HEAD
[0.7.0]: https://github.com/Traficas-Revolution-Soccer/game-trs/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/Traficas-Revolution-Soccer/game-trs/releases/tag/v0.6.0
