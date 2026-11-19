# Política de segurança

## Versões suportadas

| Versão | Suporte |
|---|---|
| 0.7.x | ✅ |
| < 0.7 | ❌ |

## Como reportar uma falha

**Não abra uma issue pública com detalhes da falha.**

- Use **Security → Report a vulnerability** neste repositório no GitHub.
- Se a opção não estiver disponível, abra uma issue curta, sem detalhes, pedindo um canal privado.

Ajuda muito incluir:
- o que é possível fazer (ex.: rodar código ao importar um clube, corromper os dados salvos);
- passos para reproduzir e, se for o caso, o arquivo usado;
- versão ou commit, navegador e sistema.

## Escopo

O jogo roda inteiro no navegador, sem servidor e sem conta. Ficam no escopo:
- **importação de clubes, jogadores, uniformes e imagens:** um arquivo malicioso não pode rodar código nem travar o jogo;
- **dados salvos** no navegador (localStorage e IndexedDB) e as migrações entre versões;
- o **HTML offline** gerado por `tools/build_standalone.py`.

Falhas no controle pelo celular (servidor, PIN, WebSocket) vão para o [trs-mobile-device-management](https://github.com/Traficas-Revolution-Soccer/trs-mobile-device-management/security).
