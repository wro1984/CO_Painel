# NS Painel · B2C Suporte (v3.2.0)

Painel de NS 5 min por **Dia**, **Semana** e **Mês**, instalável no celular.

Esta cópia é publicada num repositório **público** (GitHub Pages gratuito). Por isso os
números nunca vão abertos para o GitHub: o MAPI publica um `dados.json`
**criptografado**, e só abre quem tem acesso aprovado.

## Como o acesso funciona
1. A pessoa entra no MAPI (pelo HUB, na rede da empresa) e pede acesso ao NS Painel.
2. Um administrador aprova no MAPI. O MAPI mostra à pessoa um **código pessoal**
   (`XXXX-XXXX-XXXX-XXXX`), uma única vez.
3. No app, a pessoa digita **matrícula + código** uma vez. O aparelho guarda uma chave
   que não pode ser lida nem copiada pelo app, e o código não fica salvo.
4. Acesso removido no MAPI: na publicação seguinte a chave dos dados muda, a pessoa sai
   da lista e o app dela apaga o acesso e os dados salvos no aparelho.

## Arquivos
| Arquivo | O que é |
|---|---|
| `index.html`, `app.js`, `parser.js` | o app (telas, gráficos, leitura e validação do TXT) |
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

## Testar localmente
```
pip install cryptography
python ferramentas/dados_teste.py --ate 2026-10-08 > teste.txt
python ferramentas/pacote.py codigo                       # gera um código
python ferramentas/pacote.py montar --txt teste.txt --acesso TESTE:<código> \
    --estado acessos_local.json --saida dados.json
python -m http.server 8000                                # abra http://localhost:8000
```

## Cuidados
- **Nunca** enviar `data.txt` ou outro TXT aberto para este repositório: o histórico do git
  é público e guarda o arquivo mesmo depois de apagado. O `.gitignore` já bloqueia `*.txt`.
- O `dados.json` publicado hoje tem **dados de teste** (números inventados, coluna `ORIGEM = TESTE`).
