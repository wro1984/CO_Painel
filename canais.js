/* NS Painel — Canais do B2C: voz, Vivo+ e chat (a abertura do volume que o PBI mostra).
 * Puro JS (navegador e Node). Lê o campo opcional "canais" do dados.json (JSON feito pelo MAPI, ns_canais.canais_json, cifrado com a
 * mesma chave), soma os dias do consolidado B2C e confere com o volume do C.O. do TXT do NS.
 * Só informa: não muda nenhum número do NS. Qualquer dúvida (formato, dia faltando, soma que não bate) = não mostra a abertura.
 *
 * Formato (v1): {v:1, inicio:'AAAA-MM-DD', ate:'AAAA-MM-DD', dias:[{d:'AAAA-MM-DD', voz, vivo, chat, tvoz, tvivo}]}
 *   voz  = canal VOZ_GENESYS da view do PBI, mídia diferente de 'VIVO +' (a voz que entra pela URA)
 *   vivo = canal VOZ_GENESYS, mídia 'VIVO +' (skills _MM: o atendimento por mensagem do Vivo+)
 *   chat = o chat Dani
 *   tvoz / tvivo (opcionais) = a TEL (canal VOZ_TEL), por mídia: a TEL é voz
 * No PBI, "VOZ + VIVO +" = voz + vivo e "CHAT" = chat. voz + vivo + chat = o volume do C.O. no NS; tvoz + tvivo = o volume da TEL.
 * O B2C (CO + TEL) por canal: Voz = voz + tvoz, Vivo + = vivo + tvivo, Chat = chat.
 */
(function (root) {
  'use strict';
  const VERSAO = '3.16.2';
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const nat = n => Number.isInteger(n) && n >= 0;

  // texto do campo -> dados válidos, ou null (formato desconhecido, dia repetido, número sem sentido)
  function ler(texto) {
    let d;
    try { d = JSON.parse(String(texto)); } catch (e) { return null; }
    if (!d || d.v !== 1 || !Array.isArray(d.dias) || !ISO.test(d.inicio || '') || !ISO.test(d.ate || '')) return null;
    const vistos = new Set();
    for (const x of d.dias) {
      if (!x || !ISO.test(x.d || '') || vistos.has(x.d) || !nat(x.voz) || !nat(x.vivo) || !nat(x.chat)) return null;
      if ((x.tvoz !== undefined && !nat(x.tvoz)) || (x.tvivo !== undefined && !nat(x.tvivo))) return null;
      vistos.add(x.d);
    }
    return d;
  }

  // Soma dos dias que uma linha do consolidado B2C cobre (a TEL só começou em 16/11/2026: r.desde). Devolve null sem nenhum dia.
  //   completo = o campo tem TODOS os dias da linha; confere = completo e voz + vivo + chat é exatamente o volume do C.O. da linha.
  function doPeriodo(dados, r) {
    if (!dados || !r || !r.co) return null;
    const ini = r.desde && r.desde > r.inicio ? r.desde : r.inicio;
    const s = { voz: 0, vivo: 0, chat: 0, tvoz: 0, tvivo: 0, dias: 0 };
    let temTel = true;
    for (const x of dados.dias) {
      if (x.d < ini || x.d > r.fim) continue;
      s.voz += x.voz; s.vivo += x.vivo; s.chat += x.chat; s.dias++;
      if (x.tvoz === undefined || x.tvivo === undefined) temTel = false; else { s.tvoz += x.tvoz; s.tvivo += x.tvivo; }
    }
    if (!s.dias) return null;
    s.completo = s.dias === r.dias;
    s.confere = s.completo && s.voz + s.vivo + s.chat === r.co.volume;
    // B2C = CO + TEL: só se a TEL também fecha exatamente com o volume dela (r.tel.volume); senão fica só a abertura do CO
    s.confereTel = !!(s.confere && temTel && r.tel && s.tvoz + s.tvivo === r.tel.volume);
    if (s.confereTel) s.b2c = { voz: s.voz + s.tvoz, vivo: s.vivo + s.tvivo, chat: s.chat };
    return s;
  }

  const api = { VERSAO, ler, doPeriodo };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.NSCanais = api;
})(typeof self !== 'undefined' ? self : this);
