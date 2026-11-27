/* NS Painel — Manobra: quem atendeu (humano, robô e os dois juntos).
 * Puro JS (navegador e Node). Lê o campo opcional "manobra" do dados.json (JSON feito pelo MAPI, ns_manobra.frentes_json),
 * soma os dias de um período e confere com a linha da Manobra do TXT do NS.
 * Só informa: não muda nenhum número do NS. Qualquer dúvida (formato, soma que não bate) = não mostra.
 *
 * Formato (v1): {v:1, inicio:'AAAA-MM-DD', ate:'AAAA-MM-DD', corte_min:5,
 *                dias:[{d:'AAAA-MM-DD', h:[solicitações, atendidas, no_corte], r:[...]}]}
 *   h = humano (AUTOMACAO nula ou 0, a conta do NS da Manobra) · r = robô (automação).
 * Regra (a mesma do NS da Manobra): NS = atendidas em até o corte ÷ atendidas.
 */
(function (root) {
  'use strict';
  const VERSAO = '3.16.1';
  const SEGMENTO = 'B2C_MANOBRA';
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const trio = a => Array.isArray(a) && a.length === 3 && a.every(n => Number.isInteger(n) && n >= 0) && a[1] <= a[0] && a[2] <= a[1];

  // texto do campo -> dados válidos, ou null (formato desconhecido, dia repetido, número sem sentido)
  function ler(texto) {
    let d;
    try { d = JSON.parse(String(texto)); } catch (e) { return null; }
    if (!d || d.v !== 1 || !Array.isArray(d.dias) || !ISO.test(d.inicio || '') || !ISO.test(d.ate || '')) return null;
    const vistos = new Set();
    for (const x of d.dias) {
      if (!x || !ISO.test(x.d || '') || vistos.has(x.d) || !trio(x.h) || !trio(x.r)) return null;
      vistos.add(x.d);
    }
    return d;
  }

  const zero = () => ({ vol: 0, at: 0, cor: 0 });
  const mais = (a, [v, at, c]) => { a.vol += v; a.at += at; a.cor += c; };

  // soma dos dias de `inicio` a `fim` (inclusive): {h, r, t (os dois juntos), dias}
  function somar(dados, inicio, fim) {
    const s = { h: zero(), r: zero(), t: zero(), dias: 0 };
    for (const x of dados.dias) {
      if (x.d < inicio || x.d > fim) continue;
      mais(s.h, x.h); mais(s.r, x.r); mais(s.t, x.h); mais(s.t, x.r); s.dias++;
    }
    return s;
  }

  // NS da frente: no corte ÷ atendidas (null sem atendidas)
  const ns = f => f.at > 0 ? f.cor / f.at : null;
  // parte de cada frente nas solicitações (0 a 1; null sem solicitações)
  const parte = (f, t) => t.vol > 0 ? f.vol / t.vol : null;

  // O humano daqui tem que ser exatamente a linha da Manobra do NS (volume, atendidas, no corte): senão os dois contam coisas diferentes
  const confere = (s, row) => !!row && s.h.vol === row.volume && s.h.at === row.total && s.h.cor === row.ate;

  // Manobra nos MESMOS dias de uma linha do consolidado B2C (que só vale a partir do início da TEL: r.desde). Cards da aba B2C:
  // solicitações (humano + robô), atendidas pelo humano e pelo robô. completo = a Manobra cobre todos os dias da linha (senão o
  // Acionamentos não soma, porque misturaria dias com e sem Manobra). Sem dado da Manobra nos dias = null.
  function doPeriodo(dados, r) {
    if (!dados || !r) return null;
    const ini = r.desde && r.desde > r.inicio ? r.desde : r.inicio;
    const s = somar(dados, ini, r.fim);
    if (!s.dias) return null;
    return { vol: s.t.vol, hum: s.h.at, rob: s.r.at, dias: s.dias, completo: s.dias === r.dias };
  }
  // Acionamentos = chamadas recebidas do CO + da TEL + solicitações da Manobra (humano + robô); null se a Manobra não cobre o período
  function acionamentos(r, man) {
    if (!r || !r.co || !r.tel || !man || !man.completo) return null;
    return { co: r.co.volume, tel: r.tel.volume, man: man.vol, total: r.co.volume + r.tel.volume + man.vol };
  }

  const api = { VERSAO, SEGMENTO, ler, somar, ns, parte, confere, doPeriodo, acionamentos };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.NSFrentes = api;
})(typeof self !== 'undefined' ? self : this);
