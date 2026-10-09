"""
Monta o dados.json criptografado que o app lê (mesmo formato de cripto.js).

É a referência do que o MAPI faz a cada publicação:
  1. cada acesso aprovado tem um código pessoal; dele sai a chave da pessoa
     (PBKDF2-SHA256 com o salt dela). O MAPI guarda só id, salt e essa chave —
     nunca o código;
  2. a cada publicação sorteia uma chave nova para os dados, cifra o TXT com ela
     e cifra essa chave uma vez para cada pessoa aprovada.
Quem sai da lista de aprovados não recebe a chave nova e para de abrir os dados.

Uso (teste local):
  python ferramentas/pacote.py codigo
  python ferramentas/pacote.py montar --txt dados.txt --acesso MATRICULA:CODIGO \
      --estado acessos_local.json --saida dados.json

`--estado` guarda id/salt/chave de cada acesso entre uma publicação e outra, como
o MAPI faz no banco. Sem ele, cada montagem sorteia salts novos e quem já entrou
no app precisa digitar o código de novo. Esse arquivo é segredo: não vai para o git.

Requer: pip install cryptography
"""

import argparse
import base64
import hashlib
import json
import os
import secrets
import sys
from datetime import datetime, timezone

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

ITERACOES = 310_000
ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"   # sem O, 0, I e 1 (se confundem)


def _b64(b: bytes) -> str:
    return base64.b64encode(b).decode("ascii")


def norm_matricula(m: str) -> str:
    return "".join(str(m or "").split()).upper()


def norm_codigo(c: str) -> str:
    return "".join(ch for ch in str(c or "").upper() if ch.isalnum())


def id_de(matricula: str) -> str:
    return hashlib.sha256(("co-painel:" + norm_matricula(matricula)).encode("utf-8")).hexdigest()


def novo_codigo() -> str:
    """16 caracteres (80 bits), em blocos de 4: ABCD-EFGH-JKLM-NPQR."""
    c = "".join(secrets.choice(ALFABETO) for _ in range(16))
    return "-".join(c[i:i + 4] for i in range(0, 16, 4))


def chave_do_codigo(codigo: str, salt: bytes, iteracoes: int = ITERACOES) -> bytes:
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=iteracoes)
    return kdf.derive(norm_codigo(codigo).encode("utf-8"))


def novo_acesso(matricula: str, codigo: str, iteracoes: int = ITERACOES) -> dict:
    """O que o MAPI guarda de uma pessoa aprovada (a `chave` deve ficar cifrada no banco)."""
    salt = os.urandom(16)
    return {"id": id_de(matricula), "salt": _b64(salt),
            "chave": _b64(chave_do_codigo(codigo, salt, iteracoes))}


def montar_pacote(texto: bytes, acessos: list, iteracoes: int = ITERACOES) -> dict:
    if not acessos:
        raise ValueError("Nenhum acesso aprovado: ninguém conseguiria abrir os dados.")
    chave_dados = AESGCM.generate_key(bit_length=256)
    iv = os.urandom(12)
    pacote = {
        "app": "co-painel", "v": 1,
        "gerado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "kdf": {"alg": "PBKDF2-SHA256", "iter": iteracoes},
        "acessos": {},
        "dados": {"iv": _b64(iv), "ct": _b64(AESGCM(chave_dados).encrypt(iv, texto, None))},
    }
    for a in acessos:
        iv_a = os.urandom(12)
        chave = base64.b64decode(a["chave"])
        pacote["acessos"][a["id"]] = {"salt": a["salt"], "iv": _b64(iv_a),
                                      "ct": _b64(AESGCM(chave).encrypt(iv_a, chave_dados, None))}
    return pacote


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("codigo", help="gera um código de acesso")
    m = sub.add_parser("montar", help="monta o dados.json")
    m.add_argument("--txt", required=True, help="TXT exportado (tabulação, com cabeçalho)")
    m.add_argument("--acesso", action="append", required=True, metavar="MATRICULA:CODIGO")
    m.add_argument("--saida", default="dados.json")
    m.add_argument("--estado", help="arquivo local com os acessos já criados (fora do git)")
    m.add_argument("--iteracoes", type=int, default=ITERACOES)
    a = ap.parse_args()
    if a.cmd == "codigo":
        print(novo_codigo())
        return
    guardados = {}
    if a.estado and os.path.exists(a.estado):
        with open(a.estado, encoding="utf-8") as f:
            guardados = {x["id"]: x for x in json.load(f)}
    acessos = []
    for item in a.acesso:
        if ":" not in item:
            sys.exit(f"--acesso deve ser MATRICULA:CODIGO (veio {item!r})")
        mat, cod = item.split(":", 1)
        g = guardados.get(id_de(mat))
        if g and base64.b64decode(g["chave"]) == chave_do_codigo(cod, base64.b64decode(g["salt"]), a.iteracoes):
            acessos.append(g)
        else:
            acessos.append(novo_acesso(mat, cod, a.iteracoes))
    if a.estado:
        with open(a.estado, "w", encoding="utf-8") as f:
            json.dump(acessos, f)
    with open(a.txt, "rb") as f:
        texto = f.read()
    with open(a.saida, "w", encoding="utf-8") as f:
        json.dump(montar_pacote(texto, acessos, a.iteracoes), f, ensure_ascii=False)
    print(f"{a.saida}: {len(texto)} bytes de dados, {len(acessos)} acesso(s).")


if __name__ == "__main__":
    main()
