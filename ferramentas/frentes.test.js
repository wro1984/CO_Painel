// node --test ferramentas/frentes.test.js  — leitura, soma e conferência do campo "manobra" (frentes.js). Números inventados.
const test = require('node:test');
const assert = require('node:assert');
const F = require('../frentes.js');

const dado = (dias) => JSON.stringify({ v: 1, inicio: '2026-10-01', ate: '2026-10-03', corte_min: 5, dias });
const D = [
  { d: '2026-10-01', h: [10, 9, 6], r: [20, 20, 20] },
  { d: '2026-10-02', h: [12, 10, 5], r: [0, 0, 0] },
  { d: '2026-10-03', h: [8, 8, 8], r: [30, 29, 28] },
];

test('lê dados válidos', () => { assert.strictEqual(F.ler(dado(D)).dias.length, 3); });

test('recusa o que não faz sentido', () => {
  assert.strictEqual(F.ler('lixo'), null);
  assert.strictEqual(F.ler('{"v":2,"dias":[]}'), null);
  assert.strictEqual(F.ler(dado([{ d: '2026-10-01', h: [1, 2, 0], r: [0, 0, 0] }])), null);      // atendidas > solicitações
  assert.strictEqual(F.ler(dado([{ d: '2026-10-01', h: [2, 1, 2], r: [0, 0, 0] }])), null);      // no corte > atendidas
  assert.strictEqual(F.ler(dado([{ d: '2026-10-01', h: [1, 1, 1], r: [0, 0, -1] }])), null);     // negativo
  assert.strictEqual(F.ler(dado([{ d: '2026-10-01', h: [1, 1, 1] }])), null);                    // falta o robô
  assert.strictEqual(F.ler(dado([D[0], D[0]])), null);                                            // dia repetido
  assert.strictEqual(F.ler(dado([{ d: '01/10/2026', h: [1, 1, 1], r: [0, 0, 0] }])), null);      // data fora do formato
});

test('soma o período e junta os dois (total = humano + robô)', () => {
  const s = F.somar(F.ler(dado(D)), '2026-10-01', '2026-10-02');
  assert.deepStrictEqual(s.h, { vol: 22, at: 19, cor: 11 });
  assert.deepStrictEqual(s.r, { vol: 20, at: 20, cor: 20 });
  assert.deepStrictEqual(s.t, { vol: 42, at: 39, cor: 31 });
  assert.strictEqual(s.dias, 2);
});

test('período aberto: dias fora do dado não entram, as pontas contam', () => {
  const s = F.somar(F.ler(dado(D)), '2026-09-28', '2026-10-04');
  assert.strictEqual(s.dias, 3);
  assert.strictEqual(F.somar(F.ler(dado(D)), '2026-10-03', '2026-10-03').h.vol, 8);
});

test('NS e participação', () => {
  const s = F.somar(F.ler(dado(D)), '2026-10-01', '2026-10-03');
  assert.strictEqual(F.ns(s.h), 19 / 27);
  assert.strictEqual(F.ns({ vol: 5, at: 0, cor: 0 }), null);          // sem atendidas: sem NS
  assert.strictEqual(F.parte(s.r, s.t), 50 / 80);
  assert.strictEqual(F.parte(s.h, { vol: 0, at: 0, cor: 0 }), null);
});

test('só confere se o humano bate com a linha da Manobra do NS', () => {
  const s = F.somar(F.ler(dado(D)), '2026-10-01', '2026-10-01');
  assert.strictEqual(F.confere(s, { volume: 10, total: 9, ate: 6 }), true);
  assert.strictEqual(F.confere(s, { volume: 11, total: 9, ate: 6 }), false);
  assert.strictEqual(F.confere(s, { volume: 10, total: 9, ate: 5 }), false);
  assert.strictEqual(F.confere(s, null), false);
});

test('a versão acompanha a do app', () => {
  const app = require('fs').readFileSync(__dirname + '/../app.js', 'utf8').match(/APP_VERSION = '([^']+)'/)[1];
  const sw = require('fs').readFileSync(__dirname + '/../sw.js', 'utf8').match(/VERSION = '([^']+)'/)[1];
  const sis = require('fs').readFileSync(__dirname + '/../sistemas.js', 'utf8').match(/VERSAO = '([^']+)'/)[1];
  assert.deepStrictEqual([F.VERSAO, sw, sis], [app, app, app]);
});

// ---- v3.15.0: cards da aba B2C (Manobra nos dias do consolidado, Acionamentos) ----
test('doPeriodo: soma a Manobra só a partir do início do consolidado (desde)', () => {
  const dados = F.ler(dado(D));
  const m = F.doPeriodo(dados, { inicio: '2026-10-01', fim: '2026-10-03', desde: '2026-10-02', dias: 2 });
  assert.deepStrictEqual(m, { vol: 12 + 8 + 0 + 30, hum: 10 + 8, rob: 0 + 29, dias: 2, completo: true });
  const parcial = F.doPeriodo(dados, { inicio: '2026-10-01', fim: '2026-10-03', desde: '2026-10-01', dias: 5 });
  assert.strictEqual(parcial.completo, false);                       // a Manobra cobre 3 dos 5 dias
  assert.strictEqual(F.doPeriodo(dados, { inicio: '2026-11-01', fim: '2026-11-01', dias: 1 }), null);   // sem dado nos dias
  assert.strictEqual(F.doPeriodo(null, { inicio: '2026-10-01', fim: '2026-10-01', dias: 1 }), null);
});

test('acionamentos = CO + TEL + Manobra (humano + robô); sem Manobra completa = null', () => {
  const r = { co: { volume: 300 }, tel: { volume: 200 } };
  assert.deepStrictEqual(F.acionamentos(r, { vol: 50, completo: true }), { co: 300, tel: 200, man: 50, total: 550 });
  assert.strictEqual(F.acionamentos(r, { vol: 50, completo: false }), null);
  assert.strictEqual(F.acionamentos(r, null), null);
  assert.strictEqual(F.acionamentos({ volume: 1 }, { vol: 50, completo: true }), null);   // linha sem co/tel (não é o B2C)
});
