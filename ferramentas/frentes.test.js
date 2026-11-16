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
