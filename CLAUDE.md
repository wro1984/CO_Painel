# CO_Painel — NS Painel · B2C Suporte

App web instalável no celular (PWA), com o NS 5 min do B2C Suporte por **Dia**, **Semana** e
**Mês**. Publicado pelo GitHub Pages em <https://wro1984.github.io/CO_Painel/> a partir da
branch `main`. **Todo push na `main` vai para o ar em cerca de 1 minuto**, para todos os usuários.

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
| **Ordem, colunas ou regra dos dados que vêm do banco** | **não é aqui**: é a consulta `sql/ns_painel_b2c_suporte.sql` no repositório do MAPI |

## Antes de cada push

1. **Atualize a versão** em três lugares, com o mesmo número: `APP_VERSION` em `app.js`, `VERSION` em
   `sw.js` e `VERSAO` em `sistemas.js` (com versões diferentes o card de sistemas não liga). Sem isso o celular continua com a versão antiga em cache.
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
