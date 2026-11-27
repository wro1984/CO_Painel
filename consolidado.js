/* NS Painel — Consolidado: C.O. + TEL somados.
 * Puro JS (navegador e Node). Constrói, SÓ NA MEMÓRIA, o segmento virtual CONSOLIDADO a partir das linhas do B2C (o C.O.) e do
 * B2C_TEL (a TEL/parceira) do TXT do NS. Nada é gravado e nenhum número do TXT muda: o MAPI continua publicando só B2C e B2C_TEL.
 *
 * Regra (a mesma do cardCoTel desde a v3.13.0): NS = (no corte do C.O. + no corte da TEL) ÷ (atendidas do C.O. + atendidas da TEL).
 * Dia: só entra a partir do primeiro dia da TEL com chamadas (16/11/2026); as linhas "SEM DADOS" (volume 0) da TEL antes disso não contam, senão o consolidado mostraria só o C.O.
 * Semana e mês: soma dos dias consolidados do período. Se a TEL só cobre parte do período (mês em que a TEL começou), o período
 * sai como INCOMPLETO (dias/diasPeriodo, asterisco), igual a um mês em aberto.
 * Qualquer dúvida (corte ou base do NS diferentes entre os dois, só um dos segmentos) = devolve [] e a aba Consolidado não aparece.
 */
(function (root) {
  'use strict';
  const VERSAO = '3.15.0';
  const SEGMENTO = 'CONSOLIDADO', CO = 'B2C', TEL = 'B2C_TEL';
  const segDe = r => r.segmento || CO;
  const ns4 = (a, b) => b > 0 ? Math.round(a / b * 10000) / 10000 : null;

  // a parte de cada um nos MESMOS dias do consolidado (a TEL pode cobrir só parte do período): o card do C.O. e o da TEL no consolidado usam isto
  const parte = r => ({ volume: r.volume, total: r.total, ate: r.ate });
  const somaParte = l => l.reduce((a, r) => ({ volume: a.volume + r.volume, total: a.total + r.total, ate: a.ate + r.ate }), { volume: 0, total: 0, ate: 0 });

  function consolidar(rows) {
    rows = Array.isArray(rows) ? rows : [];
    const co = rows.filter(r => segDe(r) === CO), tel = rows.filter(r => segDe(r) === TEL);
    if (!co.length || !tel.length) return [];
    const unico = (l, c) => { const s = new Set(l.map(r => r[c])); return s.size === 1 ? [...s][0] : undefined; };
    const corte = unico(co, 'corte'), corteT = unico(tel, 'corte');
    if (corte === undefined || corte !== corteT) return [];
    const base = unico(co, 'base'), baseT = unico(tel, 'base');
    if (base !== 'ATENDIDAS' || baseT !== 'ATENDIDAS') return [];

    // A consulta do MAPI traz uma linha por dia para CADA segmento, com volume 0 ("SEM DADOS") nos dias em que o segmento não existia:
    // a TEL tem linha desde o começo da janela, mas só tem dado a partir de 16/11/2026. Por isso o consolidado começa no PRIMEIRO dia
    // da TEL com chamadas; dali em diante, dia da TEL sem chamadas conta como zero. Antes disso não há consolidado (não é "só o C.O.").
    const telDia = tel.filter(r => r.tipo === 'DIA');
    const inicioTel = telDia.filter(r => r.volume > 0).map(r => r.inicio).sort()[0];
    if (!inicioTel) return [];
    const telPor = new Map(telDia.map(r => [r.ordem, r]));
    const dias = [];     // dias com as duas linhas, a partir do início da TEL
    for (const c of co) {
      if (c.tipo !== 'DIA' || c.inicio < inicioTel) continue;
      const t = telPor.get(c.ordem);
      if (!t) continue;
      dias.push({ c, t, inicio: c.inicio, volume: c.volume + t.volume, total: c.total + t.total, ate: c.ate + t.ate });
    }
    if (!dias.length) return [];

    const base0 = (c, extra) => Object.assign({
      ordem: c.ordem, tipo: c.tipo, periodo: c.periodo, inicio: c.inicio, fim: c.fim, meta: c.meta, status: null, extras: {},
      segmento: SEGMENTO, corte, base: 'ATENDIDAS', conferidoSoma: true, consolidado: true, desde: inicioTel,
    }, extra);
    const out = [];
    for (const d of dias) {
      out.push(base0(d.c, { dias: 1, diasPeriodo: 1, completo: true, volume: d.volume, total: d.total, ate: d.ate, ns: ns4(d.ate, d.total), semDados: d.volume === 0,
        co: parte(d.c), tel: parte(d.t) }));
    }
    for (const c of co) {
      if (c.tipo === 'DIA') continue;
      const ds = dias.filter(d => d.inicio >= c.inicio && d.inicio <= c.fim);
      if (!ds.length) continue;
      const soma = k => ds.reduce((a, d) => a + d[k], 0);
      const completo = ds.length === c.diasPeriodo;
      const rot = String(c.periodo || '').replace(/\s*\*\s*$/, '') + (completo ? '' : '*');
      out.push(base0(c, { periodo: rot, dias: ds.length, diasPeriodo: c.diasPeriodo, completo, volume: soma('volume'), total: soma('total'), ate: soma('ate'),
        ns: ns4(soma('ate'), soma('total')), semDados: soma('volume') === 0,
        co: somaParte(ds.map(d => d.c)), tel: somaParte(ds.map(d => d.t)) }));
    }
    return out;
  }

  const api = { VERSAO, SEGMENTO, consolidar };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.NSConsolidado = api;
})(typeof self !== 'undefined' ? self : globalThis);
