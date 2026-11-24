"""
Gera um TXT de TESTE (números inventados) no mesmo formato do SQL Developer.

Serve para testar o app e a publicação sem expor dados reais: o repositório é
público. Cada linha leva a coluna extra ORIGEM = TESTE, que o app mostra no
detalhe do período.

    python ferramentas/dados_teste.py --ate 2026-10-08 > teste.txt
    python ferramentas/dados_teste.py --ate 2026-11-23 --tel-desde 2026-11-16 > teste.txt   # com C.O. (B2C) e TEL (B2C_TEL)
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


def _segmento(ate: date, rnd: random.Random, desde: date = None, escala: float = 1.0):
    """Linhas (sem cabeçalho) de um segmento: meses, semanas e os 14 últimos dias. `desde` = primeiro dia com dados (a TEL começa depois)."""
    inicio = date(ate.year, ate.month, 1)
    for _ in range(4):
        inicio = (inicio - timedelta(days=1)).replace(day=1)
    dias = {}
    d = inicio
    while d <= ate:
        v, t, a = _dia(d, rnd)
        if desde is None or d >= desde:
            dias[d] = (int(v * escala), int(t * escala), int(a * escala))
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
        if q:
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
        if q:
            linhas.append(_linha(rot, q, v, t, a, "SEMANA",
                                 "COMPLETA - 7 DIAS" if completo else f"INCOMPLETA - {q} DIA(S)", f"2{ini:%Y%m%d}"))
    for i in range(13, -1, -1):
        d = ate - timedelta(days=i)
        rot = f"{d:%d}/{MESES[d.month - 1].upper()}"
        if d in dias:
            v, t, a = dias[d]
            linhas.append(_linha(rot, 1, v, t, a, "DIA", "DIA", f"3{d:%Y%m%d}"))
        elif desde is not None:
            # como a consulta real: o segmento tem uma linha por dia, com volume 0 ("SEM DADOS") antes de existir
            linhas.append(_linha(rot, 1, 0, 0, 0, "DIA", "SEM DADOS", f"3{d:%Y%m%d}"))
    return linhas


def gerar(ate: date, semente: int = 7, tel_desde: date = None) -> str:
    """Sem `tel_desde`: um segmento só (formato antigo). Com `tel_desde`: B2C (o C.O.) e B2C_TEL, que só tem dados a partir dessa data."""
    rnd = random.Random(semente)
    cab = ["PERIODO", "QUANTIDADE_DIAS", "VOLUME", "TOTAL_ATENDIDAS", "ATE_5_MIN", "NS_5_MIN", "META_NS",
           "STATUS_NS", "TIPO_PERIODO", "STATUS_PERIODO", "ORDEM", "ORIGEM"]
    if tel_desde is None:
        return "\n".join("\t".join(l) for l in [cab] + _segmento(ate, rnd)) + "\n"
    cab += ["SEGMENTO", "TEMPO_CORTE_MINUTOS"]
    co = [l + ["B2C", "5"] for l in _segmento(ate, rnd)]
    tel = [l + ["B2C_TEL", "5"] for l in _segmento(ate, rnd, tel_desde, 0.7)]
    return "\n".join("\t".join(l) for l in [cab] + co + tel) + "\n"


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--ate", default=(date.today() - timedelta(days=1)).isoformat(), help="último dia (AAAA-MM-DD)")
    ap.add_argument("--semente", type=int, default=7)
    ap.add_argument("--tel-desde", help="gera também o segmento B2C_TEL a partir desta data (AAAA-MM-DD)")
    args = ap.parse_args()
    print(gerar(date.fromisoformat(args.ate), args.semente, date.fromisoformat(args.tel_desde) if args.tel_desde else None), end="")
