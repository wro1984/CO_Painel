# Painel - Nível de Serviço (v3.7.3)

Painel de NS 5 min por **Dia**, **Semana** e **Mês**, instalável no celular.

Esta cópia é publicada num repositório **público** (GitHub Pages gratuito). Por isso os
números nunca vão abertos para o GitHub: o MAPI publica um `dados.json`
**criptografado**, e só abre quem tem acesso aprovado.

## Como o acesso funciona
1. A pessoa entra no MAPI (pelo HUB, na rede da empresa) e pede acesso ao NS Painel.
2. Um administrador aprova no MAPI. O MAPI mostra à pessoa um **código pessoal**
   (`XXXX-XXXX-XXXX-XXXX`), uma única vez.
   Ou o administrador cadastra a pessoa direto no MAPI e escolhe a chave (pode ser uma palavra).
3. No app, a pessoa digita **matrícula + chave** uma vez (acento, maiúsculas e traços não importam). O aparelho guarda uma chave
   que não pode ser lida nem copiada pelo app, e o código não fica salvo.
4. Acesso removido no MAPI: na publicação seguinte a chave dos dados muda, a pessoa sai
   da lista e o app dela apaga o acesso e os dados salvos no aparelho.

## Arquivos
| Arquivo | O que é |
|---|---|
| `index.html`, `app.js`, `parser.js` | o app (telas, gráficos, leitura e validação do TXT) |
| `sistemas.js` | card de problemas sistêmicos (matriz, lista e detalhe dos chamados) |
| `cripto.js` | login e abertura do `dados.json` (WebCrypto: PBKDF2-SHA256 + AES-GCM 256) |
| `dados.json` | os dados criptografados, publicados pelo MAPI |
| `sw.js`, `manifest.webmanifest`, `icons/` | instalação no celular e uso sem internet |
| `ferramentas/pacote.py` | referência do que o MAPI faz para montar o `dados.json` |
| `ferramentas/dados_teste.py` | gera um TXT com números inventados, para testes |

## Formato do TXT (dentro do `dados.json`)
O mesmo exportado do Oracle SQL Developer: colunas separadas por **tabulação**, com o cabeçalho na 1ª linha.
- **Obrigatórias:** `PERIODO, QUANTIDADE_DIAS, VOLUME, TOTAL_ATENDIDAS, ATE_5_MIN, TIPO_PERIODO, ORDEM`.
- **Opcionais:** `NS_5_MIN, META_NS, STATUS_NS, STATUS_PERIODO`. Colunas novas aparecem no detalhe do período.
- **`ORDEM`:** tipo (`1` mês, `2` semana, `3` dia) + data `AAAAMMDD`. Ex.: `120261001`.

O app confere o arquivo antes de usar (NS = ATE ÷ TOTAL, VOLUME ≥ TOTAL ≥ ATE, somas dos
dias, linhas repetidas). Se vier com erro, ignora e continua com os últimos dados válidos.

## Segmentos (B2C, COE…)
O TXT (dentro do `dados.json`) pode trazer mais de um segmento, com as colunas `SEGMENTO` e `TEMPO_CORTE_MINUTOS`
e os nomes genéricos `ATENDIDAS_NO_CORTE` (= `ATE_5_MIN`) e `NIVEL_SERVICO` (= `NS_5_MIN`).
- O menu no topo alterna entre os segmentos (B2C primeiro); o Compartilhar é o botão redondo no canto inferior direito e manda só o segmento da tela.
- Os textos seguem o corte de cada segmento ("NS 5 min", "NS 1 min").
- Base do NS descoberta pela coluna do NS: B2C = no corte ÷ atendidas; COE = no corte ÷ chamadas recebidas (`VOLUME`).
- Período com `VOLUME` 0 não aparece.
- O formato antigo (sem `SEGMENTO`) continua valendo e é lido como B2C, 5 min. **Para o COE aparecer aqui, a consulta do MAPI precisa gerar as colunas novas.**

## Comparar o mesmo dia da semana
No modo **Dia**, acima dos gráficos ficam as cápsulas **DOM SEG TER QUA QUI SEX SÁB**.
- Sem filtro: os 7 dias mais recentes, corridos.
- Tocar num dia da semana: mostra só aquele dia (até 7 ocorrências: segunda com segunda etc.). Cards, gráficos e tabela passam a comparar com o mesmo dia da semana anterior.
- Tocar de novo no dia ligado, ou no **✕**, volta aos dias corridos. O ✕ só aparece com o filtro ligado.
- Para ter 7 de cada dia da semana, o TXT precisa trazer pelo menos 49 dias (com 42 dias aparecem 6).

## Meta
A meta vem da coluna **`META_NS`** de cada linha: cada segmento (e cada período) pode ter a sua, e uma mudança no select aparece no app sem mexer no código. Sem a coluna no arquivo, vale 90%.
Situação: Meta atingida ≥ meta · Em atenção ≥ 70% · Crítico < 70%.

## Problemas sistêmicos (campo `sistemas` do `dados.json`)
Card logo abaixo do gráfico de NS, acima da tabela.
- **De onde vem:** o `dados.json` pode trazer o campo **opcional** `sistemas: {iv, ct}`. É o TXT de chamados de sistemas no mesmo formato do `sistemas.txt` (tabulação, cabeçalho; obrigatórias `SISTEMA, DATA_INICIO, DATA_FIM`).
  - Ele é cifrado com a **mesma chave** do campo `dados` e um `iv` próprio.
  - Sem o campo, o card não aparece e o resto do app funciona igual.
  - Referência: `ferramentas/pacote.py montar ... --sistemas sistemas.txt`.
- **Todos os chamados**: o card é o mesmo no B2C e no COE.
- **Calendário**: as colunas são os mesmos dias, semanas ou meses dos gráficos de cima. Período fora do arquivo de sistemas fica listrado, como "sem dados de sistemas".
- **Expediente 08h–20h**:
  - O Total junta todos os sistemas, e sobreposição conta uma vez.
  - Indevido aparece hachurado e fica fora das contas.
  - O % é sobre o expediente do período inteiro.
- **Toques**:
  - O cabeçalho da coluna seleciona o período no painel todo.
  - Célula com chamado abre a lista; item da lista abre o detalhe.
  - O card sempre abre fechado, só com o Total.
- **No aparelho**: os sistemas ficam guardados para uso offline e são apagados na saída ou quando o acesso é removido.

## Testar localmente
```
pip install cryptography
python ferramentas/dados_teste.py --ate 2026-10-08 > teste.txt
python ferramentas/pacote.py codigo                       # gera um código
python ferramentas/pacote.py montar --txt teste.txt --acesso TESTE:<código> \
    --estado acessos_local.json --saida dados.json [--sistemas sistemas.txt]
python -m http.server 8000                                # abra http://localhost:8000
```

## Cuidados
- **Nunca** enviar `data.txt` ou outro TXT aberto para este repositório: o histórico do git
  é público e guarda o arquivo mesmo depois de apagado. O `.gitignore` já bloqueia `*.txt`.
- O `dados.json` publicado hoje tem **dados de teste** (números inventados, coluna `ORIGEM = TESTE`).

## Visão no MAPI
Em Magic → NS Painel o app aparece numa moldura de celular, sem login, para quem está logado no MAPI.
O MAPI abre os dados do lado dele e entrega ao app; nada fica gravado no navegador.
Os problemas sistêmicos também aparecem nessa visão (o MAPI entrega o texto junto com os dados).
