"""
Gera um TXT de TESTE (números inventados) no mesmo formato do SQL Developer.

Serve para testar o app e a publicação sem expor dados reais: o repositório é
público. Cada linha leva a coluna extra ORIGEM = TESTE, que o app mostra no
detalhe do período.

    python ferramentas/dados_teste.py --ate 2026-10-08 > teste.txt
"""

import argparse
import calendar
import random
from datetime import date, timedelta

MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
META = 0.8


def _dia(d: date, rnd: random.Random):
    fds = d.weekday() >= 5
    volume = rnd.randint(600, 1400) if fds else rnd.randint(4200, 6200)
    total = int(volume * rnd.uniform(0.34, 0.42))
    ate = int(total * rnd.uniform(0.62, 0.95))
    return volume, total, ate


def _status(ns):
    return "VERDE" if ns >= META else "AMARELO" if ns >= 0.7 else "VERMELHO"


def _linha(periodo, dias, v, t, a, tipo, status_periodo, ordem):
    ns = round(a / t, 4) if t else 0
    return [periodo, str(dias), str(v), str(t), str(a), str(ns).replace(".", ","), "0,8",
            _status(ns), tipo, status_periodo, ordem, "TESTE"]


def gerar(ate: date, semente: int = 7) -> str:
    rnd = random.Random(semente)
    cab = ["PERIODO", "QUANTIDADE_DIAS", "VOLUME", "TOTAL_ATENDIDAS", "ATE_5_MIN", "NS_5_MIN", "META_NS",
           "STATUS_NS", "TIPO_PERIODO", "STATUS_PERIODO", "ORDEM", "ORIGEM"]
    # todos os dias desde o início do 4º mês anterior: meses e semanas saem da soma deles
    inicio = date(ate.year, ate.month, 1)
    for _ in range(4):
        inicio = (inicio - timedelta(days=1)).replace(day=1)
    dias = {}
    d = inicio
    while d <= ate:
        dias[d] = _dia(d, rnd)
        d += timedelta(days=1)

    def soma(ini, n):
        ds = [dias[ini + timedelta(days=i)] for i in range(n) if ini + timedelta(days=i) in dias]
        return len(ds), sum(x[0] for x in ds), sum(x[1] for x in ds), sum(x[2] for x in ds)

    linhas = []
    m = inicio
    while m <= ate:
        n_mes = calendar.monthrange(m.year, m.month)[1]
        q, v, t, a = soma(m, n_mes)
        completo = q == n_mes
        linhas.append(_linha(MESES[m.month - 1] + ("" if completo else "*"), q, v, t, a, "MES",
                             "COMPLETO" if completo else "INCOMPLETO", f"1{m:%Y%m%d}"))
        m = (m.replace(day=28) + timedelta(days=4)).replace(day=1)
    seg = ate - timedelta(days=ate.weekday())          # semanas de segunda a domingo
    for k in range(6, -1, -1):
        ini = seg - timedelta(weeks=k)
        q, v, t, a = soma(ini, 7)
        fim = ini + timedelta(days=6)
        completo = q == 7
        rot = f"SEM {ini:%d/%m} A {fim:%d/%m}" + ("" if completo else "*")
        linhas.append(_linha(rot, q, v, t, a, "SEMANA",
                             "COMPLETA - 7 DIAS" if completo else f"INCOMPLETA - {q} DIA(S)", f"2{ini:%Y%m%d}"))
    for i in range(13, -1, -1):
        d = ate - timedelta(days=i)
        v, t, a = dias[d]
        linhas.append(_linha(f"{d:%d}/{MESES[d.month - 1].upper()}", 1, v, t, a, "DIA", "DIA", f"3{d:%Y%m%d}"))
    return "\n".join("\t".join(l) for l in [cab] + linhas) + "\n"


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--ate", default=(date.today() - timedelta(days=1)).isoformat(), help="último dia (AAAA-MM-DD)")
    ap.add_argument("--semente", type=int, default=7)
    args = ap.parse_args()
    print(gerar(date.fromisoformat(args.ate), args.semente), end="")
