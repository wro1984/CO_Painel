# CO_Painel — Nível de Serviço · B2C Suporte

App web instalável no celular (PWA), com o NS 5 min do B2C Suporte por **Dia**, **Semana** e
**Mês**. Publicado pelo GitHub Pages em <https://wro1984.github.io/CO_Painel/> a partir da
branch `main`. **Todo push na `main` vai para o ar em cerca de 1 minuto**, para todos os usuários.

O nome exibido do app é **Nível de Serviço** (antes "NS Painel"). Repositório, `app:"co-painel"`, ids e caches
(`ns-painel-v*`, chave `ns-painel` no HUB) continuam com os nomes antigos: mudar quebra o acesso de todo mundo.

**Topo padrão dos apps** (igual no Problemas Sistêmicos e na URA): botão de voltar ao HUB (ícone de grade, `#bHub`) à
esquerda, botões do app à direita. No desktop o topo, o menu de baixo e o botão flutuante ficam na coluna de 760 px do conteúdo.

Leia este arquivo inteiro antes de mudar qualquer coisa.

## Como funciona (o essencial)

```
IPTBM (Oracle) ──► MAPI (servidor interno) ──► dados.json CRIPTOGRAFADO ──► este repo ──► app no celular
                   consulta SQL, aprovação     (commit automático do MAPI)              login: matrícula + chave
                   de acessos, criptografia
```

- O repositório e o site são **públicos**. Os números só existem aqui **criptografados**, no `dados.json`.
- Quem gera e publica o `dados.json` é o **MAPI** (repositório `wro1984/mapi5`, módulo `ns_painel.py`).
  Quem aprova e remove acessos também é o MAPI (Magic → NS Painel).
- O app baixa o `dados.json`, abre com a chave da pessoa (`cripto.js`), confere o TXT de dentro
  (`parser.js`) e desenha as telas (`app.js`).

## Regras que não podem ser quebradas

1. **Nunca editar, apagar ou "consertar" o `dados.json`.** Ele é sobrescrito pelo MAPI várias vezes
   por dia. Mudança manual some na próxima publicação ou quebra o app de todos.
2. **Nunca commitar dados abertos** (TXT, CSV, planilha, print com números, JSON decifrado).
   O histórico do git é público e guarda o arquivo mesmo depois de apagado. O `.gitignore` bloqueia
   `*.txt`; não remova essa regra. Para testar, use `ferramentas/dados_teste.py` (números inventados).
3. **Nunca commitar segredos**: chaves de acesso, tokens, senhas, o arquivo `acessos_local.json`.
4. **Não mudar o formato da criptografia sozinho.** `cripto.js` precisa continuar igual ao que o
   MAPI gera em `ns_painel.py` (e à referência `ferramentas/pacote.py`):
   - `dados.json`: `{app:"co-painel", v:1, kdf:{alg, iter}, acessos:{id:{salt,iv,ct}}, dados:{iv,ct}}`;
   - campo **opcional** `sistemas:{iv,ct}` (desde a v3.7.0): o TXT de problemas sistêmicos (mesmo
     formato do `sistemas.txt`), cifrado com a **mesma chave** de `dados` e um `iv` próprio. Sem o
     campo, o app não mostra o card de sistemas; erro só nesse campo nunca bloqueia o NS;
   - campo **opcional** `bases:{iv,ct}` (desde a v3.10.0): JSON da **atualização das bases** (`{v:1, coletado_em, segmentos:{B2C|COE:
     {estado:'ok'|'atencao', titulo, mensagem, bases:[{id, nome, ultimo, precisao:'hora'|'dia', atrasada}]}}}`), cifrado com a
     **mesma chave** de `dados` e um `iv` próprio. Só informa: **não muda nenhum número do NS**. A regra é do MAPI (`ns_bases.py`):
     o NS fecha o dia anterior, então só é atrasada a base há **mais de 1 dia sem atualizar**. O app só desenha: faixa
     **recolhida** acima dos cards (verde = atualizadas, amarela = alguma desatualizada), que abre ao tocar com a hora do último
     registro de cada base; com a faixa amarela, o NS e as chamadas do período mais recente ganham a etiqueta "base
     desatualizada". Fica só na memória (hora velha enganaria); erro aqui nunca bloqueia o NS;
   - campo **opcional** `manobra:{iv,ct}` (desde a v3.12.0): JSON da **divisão humano × robô da Manobra** (`{v:1, inicio, ate, corte_min, dias:[{d, h:[solicitações, atendidas, no_corte], r:[...]}]}`;
     `h` = humano, `r` = robô), cifrado com a **mesma chave** de `dados` e um `iv` próprio. Vem do MAPI (`ns_manobra.frentes_json`, lido direto
     da origem .242). Só informa: **não muda nenhum número do NS** nem o TXT. `frentes.js` lê, soma por período e **confere**: o humano daqui tem que
     bater com a linha da Manobra (`B2C_MANOBRA`) do TXT (volume, atendidas, no corte); se não bater, ou o formato for outro, o bloco não aparece.
     Só aparece no segmento `B2C_MANOBRA`; B2C e COE nunca o usam. Fica só na memória. Erro aqui nunca bloqueia o NS;
   - campo **opcional** `hub:{acessos:{id_hub:{salt, iv, ct}}}` (desde a v3.8.0, login único): a chave dos dados embrulhada
     com a chave do **HUB dos apps** de quem tem o NS Painel no perfil. `id_hub` = SHA-256 de `"hub:" + MATRÍCULA`, `salt`
     = o do HUB. O app lê a credencial que o HUB guardou no IndexedDB `co-hub-acesso` (mesmo endereço) e **só lê**:
     nunca apaga nem copia (sair de todos os apps é no HUB). Sem acesso próprio, o app tenta essa credencial;
   - `id` = SHA-256 de `"co-painel:" + MATRÍCULA` (maiúscula, sem espaços);
   - chave da pessoa = PBKDF2-SHA256 (`kdf.iter` iterações) da chave normalizada; AES-GCM 256;
   - **normalização da chave** (`normCodigo`): tira acento, mantém só `A-Z a-z 0-9`, depois maiúscula.
     Tem que dar exatamente o mesmo resultado que `norm_codigo` no Python, senão ninguém entra.
   Se precisar mudar algo disso, a mudança tem que ser feita **junto** no MAPI.
5. **Não mudar o formato do TXT esperado** (`parser.js`) sem combinar com o MAPI: colunas
   `PERIODO, QUANTIDADE_DIAS, VOLUME, TOTAL_ATENDIDAS, ATE_5_MIN, NS_5_MIN, META_NS, STATUS_NS,
   TIPO_PERIODO, STATUS_PERIODO, ORDEM`, separadas por tabulação. `ORDEM` = tipo (1 mês, 2 semana,
   3 dia) + `AAAAMMDD`. O parser recusa o arquivo inteiro se uma regra falhar, e o app continua
   com os últimos dados válidos.
6. **Não carregar nada de fora**: sem CDNs, fontes externas, analytics ou chamadas a outros sites.
   O app funciona offline e os dados não podem sair do aparelho.

## Onde mexer para cada tipo de ajuste

| Quero mudar… | Onde |
|---|---|
| Cores, tamanhos, espaçamentos | `<style>` no `index.html` (variáveis em `:root`, modo escuro em `@media (prefers-color-scheme: dark)`) |
| Ordem e conteúdo dos cards (KPIs) | `painelTipo()` em `app.js` |
| Gráficos | `chartNs()` e `chartVol()` em `app.js` (SVG feito à mão, sem biblioteca) |
| Quantos dias/semanas/meses aparecem | `LIMITE` em `app.js` |
| Tabela de períodos | final de `painelTipo()` em `app.js` |
| Mensagem de compartilhar (WhatsApp/Teams) | `conteudoMsg()`, `textoCompartilhar()`, `htmlTeams()`, `svgCompartilhar()` em `app.js` |
| Tela de login | `renderLogin()` em `app.js` |
| Card de problemas sistêmicos (matriz, lista, detalhe) | `sistemas.js` (dados: `sistemasDoPacote()` em `app.js`) |
| Bloco "Quem atendeu na Manobra" (humano × robô × total) e os rótulos "· humano" dos cartões da Manobra | `cardFrentes()` e `frentesPeriodo()` em `app.js`; leitura, soma e conferência em `frentes.js` (testes: `node --test ferramentas/frentes.test.js`); estilo `.frentes`/`.fr-*` no `index.html` |
| Bloco "Atualização das bases" e a etiqueta "base desatualizada" | `cardBases()`, `basesDoPacote()` e `tagConsolida()` em `app.js`; estilo `.bases-card` e `.prov` no `index.html` |
| **Ordem, colunas ou regra dos dados que vêm do banco** | **não é aqui**: é a consulta `sql/ns_painel_nivel_servico.sql` no repositório do MAPI |
| **Quais bases aparecem, nomes, regra de atraso** | **não é aqui**: `ns_bases.py` e `sql/ns_painel_bases.sql` no MAPI |

## Antes de cada push

1. **Atualize a versão** em cinco lugares, com o mesmo número: `APP_VERSION` em `app.js`, `VERSION` em
   `sw.js`, `VERSAO` em `sistemas.js`, `VERSAO` em `frentes.js` e `VERSAO` em `consolidado.js` (com versões diferentes o card de sistemas, o da Manobra e a aba Consolidado não ligam; os testes de `frentes.js` e `consolidado.js` conferem). Sem isso o celular continua com a versão antiga em cache.
2. Arquivo novo que o app usa? Inclua em `CORE` no `sw.js` (senão não funciona offline).
3. Teste localmente (abaixo), no tamanho de celular (~390 px), em claro e escuro.
4. `git pull` antes do push: o MAPI faz commits frequentes no `dados.json`. Use merge, não force-push.

## Testar localmente, sem dados reais

```
pip install cryptography
python ferramentas/dados_teste.py --ate 2026-10-08 > teste.txt        # números inventados
python ferramentas/pacote.py montar --txt teste.txt --acesso TESTE:girassol \
    --estado acessos_local.json --saida dados.json          # + --sistemas <txt> para o card de sistemas
python -m http.server 8000                                             # abra http://localhost:8000
```

Entre com matrícula `TESTE` e chave `girassol`. **Depois do teste, desfaça o `dados.json` local**
(`git checkout dados.json`) — ele não pode ir para o repositório no lugar do publicado pelo MAPI.

Sem servidor (abrindo o `index.html` direto do disco) o app não busca dados nem entra no login.

## Estrutura

| Arquivo | Papel |
|---|---|
| `index.html` | estrutura, estilos (paleta da empresa) e navegação Painel / Dados / Histórico |
| `app.js` | estado, telas, gráficos, compartilhar, histórico, login e saída |
| `parser.js` | leitura e conferência do TXT (também roda no Node) |
| `sistemas.js` | card de problemas sistêmicos (matriz sistemas × períodos, lista e detalhe dos chamados) |
| `frentes.js` | Manobra: quem atendeu (humano, robô e total): leitura do campo `manobra`, soma por período e conferência com o TXT (também roda no Node) |
| `consolidado.js` | aba Consolidado: soma C.O. (B2C) + TEL (B2C_TEL) só na memória (também roda no Node; testes: `node --test ferramentas/consolidado.test.js`) |
| `cripto.js` | login, chave guardada no aparelho (CryptoKey não extraível) e abertura do `dados.json` |
| `sw.js` | cache para uso offline; `dados.json` sempre da rede quando houver |
| `manifest.webmanifest`, `icons/` | instalação no celular |
| `ferramentas/` | referência da criptografia e gerador de dados de teste |
| `dados.json` | **gerado pelo MAPI — não editar** |

## Login único (HUB dos apps)

O HUB fica em <https://wro1984.github.io/> (repositório `wro1984/wro1984.github.io`). Quem entrou no HUB neste aparelho
e tem o NS Painel no perfil abre o painel sem digitar a chave (`lerCredHub()` em `cripto.js`). O botão ⌂ no topo volta
para o HUB (escondido na visão do MAPI). A chave própria do painel continua valendo. Perfil sem o painel: aviso na tela de
entrada, sem apagar a credencial do HUB.

## Acesso das pessoas

Pedir, aprovar, remover e definir chaves é no MAPI (Comunicação → NS Painel, ou Comunicação → HUB dos apps para o login
único), não aqui.
Acesso removido: na publicação seguinte o app da pessoa apaga a chave e os dados do aparelho.

## Visão do MAPI (app dentro do MAPI, sem login)

Em Magic → NS Painel, o MAPI mostra o app num iframe com `?mapi` na URL. Nesse modo (`MODO_MAPI`
em `app.js`) o app **não pede login, não grava nada** (sem IndexedDB, sem chave, sem service worker)
e recebe o TXT do MAPI por `postMessage`:
- o app manda `{tipo: 'co-painel:pronto', versao}` para a janela pai;
- o MAPI responde `{tipo: 'co-painel:dados', texto, publicadoEm, origem}` (ou `{erro}`), e o app só
  aceita mensagem vinda da própria janela pai.
- na mesma mensagem o MAPI pode mandar o campo opcional `sistemas` (texto de problemas sistêmicos); o app só o mantém na memória.
Fora de um iframe, `?mapi` não muda nada: o login continua obrigatório. Não remova essas travas,
e não mude os nomes das mensagens sem mudar `static/js/ns_painel.js` no MAPI junto.

## Ponto de retorno

A branch `rollback-v3.6.0` guarda o app antes dos problemas sistêmicos (3.7.x). Para voltar: restaurar na `main`
os arquivos dessa branch (um commit novo, sem reescrever o histórico). O `dados.json` que traz o campo
`sistemas` continua válido na 3.6.0, que simplesmente o ignora.

## CO × TEL (desde a v3.13.0)

O MAPI publica a TEL/parceira como segmento próprio (`B2C_TEL`, a partir de 16/11/2026; o B2C é só o CO). No topo do B2C e da TEL, `cardCoTel()` em `app.js`
mostra **dois cards lado a lado (CO e TEL)** com o NS do período, a variação contra o período anterior e as atendidas, e a linha do **consolidado CO + TEL**
(no corte ÷ atendidas, somados). Tocar num card troca o segmento. O menu ganha o item **TEL** (`nomeSeg()`: `B2C_TEL` → "TEL", `B2C_MANOBRA` → "Manobra offline").
O quadro só aparece quando há a TEL no período (antes de 16/11 não há). Estilo `.cotel`/`.cons` no `index.html`.

## Abas C.O., TEL e Consolidado (desde a v3.14.0)

O menu de segmentos do topo tem **B2C · C.O. · TEL** (depois, se vierem no arquivo, Manobra offline e COE). **Atenção aos nomes**: a primeira aba, **exibida como "B2C"**,
é o segmento virtual interno `CONSOLIDADO` (C.O. + TEL); a aba **"C.O."** é o segmento `B2C` do arquivo (só o C.O.). O código, o `ns-segmento` guardado no aparelho, as bases
(`B2C`) e o MAPI continuam com os ids `B2C`/`B2C_TEL`; só o texto muda (`nomeSeg()`), e só quando existe o Consolidado (sem a TEL o menu continua com um B2C só, que é o do arquivo).
O texto "Consolidado" não aparece mais para o usuário. **O `CONSOLIDADO` é só do app**: `consolidado.js` monta o segmento virtual `CONSOLIDADO`
**na memória** (`rowsAtual()` em `app.js`) a partir de B2C + B2C_TEL; o MAPI **não** publica esse segmento e o TXT, o `dados.json` e o IndexedDB não mudam.

Regra (a mesma do consolidado do `cardCoTel`): NS = (no corte do C.O. + no corte da TEL) ÷ (atendidas do C.O. + atendidas da TEL).
- **Dia**: só existe a partir do **primeiro dia da TEL com chamadas** (16/11/2026). A consulta do MAPI traz uma linha por dia para cada segmento, com volume 0 ("SEM DADOS") nos dias em que a TEL ainda não existia: essas linhas **não** contam (v3.14.1; na v3.14.0 elas faziam o B2C mostrar só o C.O. nos dias anteriores). Depois do início, dia da TEL sem chamadas conta como zero.
- **Semana e mês**: soma dos **dias consolidados** do período. Se a TEL só cobre parte (mês em que ela começou), o período fica **incompleto**
  (`8/30`, asterisco, hachurado), como um mês aberto; passa a completo sozinho.
- **Meta**: a do C.O. Corte ou base do NS diferentes entre C.O. e TEL, ou só um dos dois no arquivo: `consolidar()` devolve `[]` e a aba some.
- Na aba Consolidado os cards **C.O. × TEL** mostram a parte de cada um **nos mesmos dias** do consolidado (`co`/`tel` na linha), e a linha
  "CO + TEL consolidado" nas abas C.O./TEL vem da linha consolidada (toque nela abre a aba Consolidado).
- Abre no **Consolidado** quem nunca escolheu um segmento; quem já escolheu continua no que escolheu. As bases e o aviso "base desatualizada" do Consolidado usam as do B2C.
- Histórico, importação e conferência de períodos fechados só enxergam o que veio no TXT (nunca o consolidado).
- Dados de teste com TEL: `python ferramentas/dados_teste.py --ate 2026-11-23 --tel-desde 2026-11-16 > teste.txt`.

## Cards da aba B2C: Acionamentos, recebidas por frente e Manobra Off (desde a v3.15.0)

Só na aba **B2C** (segmento `CONSOLIDADO`), logo abaixo dos 4 cartões e do filtro de dia da semana (`cardsB2C()` em `app.js`). Seguem o período escolhido (dia, semana, mês, ou a linha selecionada).
- **Acionamentos** = chamadas recebidas do CO + da TEL + **solicitações** da Manobra Off (humano + robô). Barra empilhada CO/TEL/Manobra. Conta pura em `FRT.acionamentos()` (`frentes.js`).
- **Chamadas recebidas por frente**: CO, TEL e CO + TEL, com a participação e a variação contra o período anterior (receber mais = vermelho, menos = verde, como nos outros cartões). Vêm de `co.volume`/`tel.volume` da linha consolidada: nada novo no TXT.
- **Manobra Off**: Manobras (solicitações), atendidas por humano (`h.at`) e por robô (`r.at`), com barra humano × robô. Vem do campo opcional `manobra` do `dados.json` (o mesmo de `frentes.js`), somado **só nos dias que o consolidado cobre** (`desde` na linha, `FRT.doPeriodo()`): mês em que a TEL começou no meio soma a Manobra só dos mesmos dias.
- Sem `manobra` no pacote, ou Manobra cobrindo só parte dos dias do período: o Acionamentos mostra "—" (não mistura dias com e sem Manobra) e o card da Manobra some (sem dado) ou avisa "X de Y dias" (parcial).
- Variação só com os dois períodos **completos** (como `varRecebidas`); período aberto mostra "—". Não muda nenhum número do NS.
- Teste: `node --test ferramentas/*.test.js` (`doPeriodo`, `acionamentos`, `desde`). Em tela: harness com iframe `?mapi` e TXT de `dados_teste.py --tel-desde` + JSON de manobra inventado.

## CO por canal: Voz, Vivo + e Chat (desde a v3.16.0)

Dentro do card "Chamadas recebidas por frente" (aba B2C), uma segunda fileira abre o **C.O.** como o PBI: **Voz**, **Vivo +** e **Chat**. No PBI, "VOZ + VIVO +" é o canal `VOZ_GENESYS` (voz pela URA + skills `_MM` do Vivo+) e "CHAT" é o chat Dani.
- Vem do campo opcional **`canais`** do `dados.json` (cifrado com a mesma chave, `K.abrirCanais`; `{v:1, inicio, ate, dias:[{d, voz, vivo, chat}]}`), feito pelo MAPI (`ns_canais.py`). Lido por `canais.js` (puro). `ferramentas/pacote.py --canais` inclui o campo.
- **Só aparece se `voz + vivo + chat` for exatamente o volume do C.O. do período** (`doPeriodo().confere`, nos dias que o consolidado cobre). Dia faltando ou soma diferente: a abertura some e o resto do card fica. Não muda nenhum número do NS.
- Mesma regra no e-mail do MAPI (`ns_email.acionamentos_b2c`).
