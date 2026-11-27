// node --test ferramentas/canais.test.js  — leitura, soma e conferência do campo "canais" (canais.js). Números inventados.
const test = require('node:test');
const assert = require('node:assert');
const C = require('../canais.js');

const dado = dias => JSON.stringify({ v: 1, inicio: '2026-11-16', ate: '2026-11-18', dias });
const D = [
  { d: '2026-11-16', voz: 1000, vivo: 200, chat: 300 },
  { d: '2026-11-17', voz: 900, vivo: 150, chat: 250 },
  { d: '2026-11-18', voz: 800, vivo: 100, chat: 200 },
];
const linha = (ini, fim, dias, vol, extra = {}) => Object.assign({ inicio: ini, fim, dias, co: { volume: vol }, desde: '2026-11-16' }, extra);

test('lê dados válidos', () => { assert.strictEqual(C.ler(dado(D)).dias.length, 3); });

test('recusa o que não faz sentido', () => {
  assert.strictEqual(C.ler('lixo'), null);
  assert.strictEqual(C.ler('{"v":2,"dias":[]}'), null);
  assert.strictEqual(C.ler(dado([{ d: '2026-11-16', voz: -1, vivo: 0, chat: 0 }])), null);   // negativo
  assert.strictEqual(C.ler(dado([{ d: '2026-11-16', voz: 1.5, vivo: 0, chat: 0 }])), null);  // não inteiro
  assert.strictEqual(C.ler(dado([{ d: '2026-11-16', voz: 1, vivo: 0 }])), null);             // falta o chat
  assert.strictEqual(C.ler(dado([D[0], D[0]])), null);                                         // dia repetido
  assert.strictEqual(C.ler(dado([{ d: '16/11/2026', voz: 1, vivo: 0, chat: 0 }])), null);     // data fora do formato
});

test('soma os dias do período e confere com o volume do C.O.', () => {
  const d = C.ler(dado(D));
  const dia = C.doPeriodo(d, linha('2026-11-17', '2026-11-17', 1, 1300));
  assert.deepStrictEqual([dia.voz, dia.vivo, dia.chat, dia.dias, dia.completo, dia.confere], [900, 150, 250, 1, true, true]);
  assert.strictEqual(dia.confereTel, false);                       // campo sem a TEL (formato da v3.16.0): só o CO
  const mes = C.doPeriodo(d, linha('2026-11-01', '2026-11-30', 3, 3900));
  assert.deepStrictEqual([mes.voz, mes.vivo, mes.chat, mes.dias, mes.completo, mes.confere], [2700, 450, 750, 3, true, true]);
});

test('só conta os dias do consolidado (desde), mesmo que o campo traga dias antes', () => {
  const d = C.ler(dado([{ d: '2026-11-10', voz: 5, vivo: 5, chat: 5 }, ...D]));
  const s = C.doPeriodo(d, linha('2026-11-01', '2026-11-30', 3, 3900));
  assert.strictEqual(s.dias, 3);
  assert.strictEqual(s.voz, 2700);
});

test('soma que não bate com o C.O. ou dia faltando: não confere (a abertura some)', () => {
  const d = C.ler(dado(D));
  assert.strictEqual(C.doPeriodo(d, linha('2026-11-17', '2026-11-17', 1, 1301)).confere, false);   // 1 chamada a mais no C.O.
  const faltando = C.doPeriodo(d, linha('2026-11-16', '2026-11-30', 15, 3700));
  assert.strictEqual(faltando.completo, false);
  assert.strictEqual(faltando.confere, false);
});

test('sem dia no campo, sem dado ou linha que não é do B2C: null', () => {
  const d = C.ler(dado(D));
  assert.strictEqual(C.doPeriodo(d, linha('2026-12-01', '2026-12-01', 1, 10)), null);
  assert.strictEqual(C.doPeriodo(null, linha('2026-11-17', '2026-11-17', 1, 1300)), null);
  assert.strictEqual(C.doPeriodo(d, { inicio: '2026-11-17', fim: '2026-11-17', dias: 1 }), null);   // sem co
});

// ---- v3.16.1: B2C = CO + TEL por canal ----
const DT = D.map((x, i) => ({ ...x, tvoz: 500 + i, tvivo: 3 }));
const linhaT = (ini, fim, dias, co, tel) => ({ ...linha(ini, fim, dias, co), tel: { volume: tel } });

test('B2C por canal: voz = voz + TEL, Vivo + = vivo + TEL (mídia), chat = chat', () => {
  const d = C.ler(dado(DT));
  const s = C.doPeriodo(d, linhaT('2026-11-17', '2026-11-17', 1, 1300, 504));
  assert.strictEqual(s.confere, true);
  assert.strictEqual(s.confereTel, true);
  assert.deepStrictEqual(s.b2c, { voz: 900 + 501, vivo: 150 + 3, chat: 250 });
  assert.strictEqual(s.b2c.voz + s.b2c.vivo + s.b2c.chat, 1300 + 504);       // = CO + TEL
});

test('TEL que não fecha com o volume dela, ou campo sem tvoz/tvivo: só a abertura do CO', () => {
  const d = C.ler(dado(DT));
  const errado = C.doPeriodo(d, linhaT('2026-11-17', '2026-11-17', 1, 1300, 505));
  assert.strictEqual(errado.confere, true);
  assert.strictEqual(errado.confereTel, false);
  assert.strictEqual(errado.b2c, undefined);
  const antigo = C.doPeriodo(C.ler(dado(D)), linhaT('2026-11-17', '2026-11-17', 1, 1300, 504));   // campo da v3.16.0: sem a TEL
  assert.strictEqual(antigo.confere, true);
  assert.strictEqual(antigo.confereTel, false);
});

test('mês: soma os dias e confere a TEL no período todo', () => {
  const d = C.ler(dado(DT));
  const s = C.doPeriodo(d, linhaT('2026-11-01', '2026-11-30', 3, 3900, 1503 + 9));
  assert.strictEqual(s.confereTel, true);
  assert.strictEqual(s.b2c.voz, 2700 + (500 + 501 + 502));
});

test('recusa tvoz/tvivo inválidos', () => {
  assert.strictEqual(C.ler(dado([{ ...D[0], tvoz: -1, tvivo: 0 }])), null);
  assert.strictEqual(C.ler(dado([{ ...D[0], tvoz: 1.5, tvivo: 0 }])), null);
});
