// Segmento virtual CONSOLIDADO (C.O. + TEL somados). Dados inventados.  node --test ferramentas/consolidado.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const C = require('../consolidado.js');

const dia = (seg, d, volume, total, ate, extra = {}) => Object.assign({ segmento: seg, tipo: 'DIA', ordem: '3202611' + String(d).padStart(2, '0'), periodo: String(d).padStart(2, '0') + '/NOV',
  inicio: `2026-11-${String(d).padStart(2, '0')}`, fim: `2026-11-${String(d).padStart(2, '0')}`, dias: 1, diasPeriodo: 1, completo: true, volume, total, ate, corte: 5, base: 'ATENDIDAS', meta: 0.9, semDados: volume === 0 }, extra);
const mes = (seg, dias, volume, total, ate) => ({ segmento: seg, tipo: 'MES', ordem: '120261101', periodo: 'NOV*', inicio: '2026-11-01', fim: '2026-11-30', dias, diasPeriodo: 30, completo: false, volume, total, ate, corte: 5, base: 'ATENDIDAS', meta: 0.9, semDados: false });
const sem = (seg, ini, volume, total, ate, dias = 7) => ({ segmento: seg, tipo: 'SEMANA', ordem: '220261' + ini, periodo: 'x', inicio: `2026-11-${ini.slice(2)}`, fim: `2026-11-${String(+ini.slice(2) + 6).padStart(2, '0')}`, dias, diasPeriodo: 7, completo: dias === 7, volume, total, ate, corte: 5, base: 'ATENDIDAS', meta: 0.9, semDados: false });

// dias 14 e 15: só C.O. (a TEL começa no 16); 16 a 18: os dois
const rows = [
  dia('B2C', 14, 100, 90, 80), dia('B2C', 15, 100, 90, 70), dia('B2C', 16, 200, 180, 90), dia('B2C', 17, 200, 180, 100), dia('B2C', 18, 0, 0, 0),
  dia('B2C_TEL', 16, 100, 100, 50), dia('B2C_TEL', 17, 100, 100, 60), dia('B2C_TEL', 18, 10, 10, 5),
  mes('B2C', 5, 600, 540, 340), mes('B2C_TEL', 3, 210, 210, 115),
  sem('B2C', '1116', 400, 360, 190, 3), sem('B2C_TEL', '1116', 210, 210, 115, 3),
];

test('dia: soma as duas linhas; antes da TEL não existe consolidado', () => {
  const r = C.consolidar(rows);
  const d = Object.fromEntries(r.filter(x => x.tipo === 'DIA').map(x => [x.inicio, x]));
  assert.deepStrictEqual(Object.keys(d).sort(), ['2026-11-16', '2026-11-17', '2026-11-18']);
  assert.strictEqual(d['2026-11-16'].volume, 300);
  assert.strictEqual(d['2026-11-16'].total, 280);
  assert.strictEqual(d['2026-11-16'].ate, 140);
  assert.strictEqual(d['2026-11-16'].ns, 0.5);                                  // 140 ÷ 280
  assert.strictEqual(d['2026-11-18'].total, 10);                                 // C.O. zerado + TEL
  assert.ok(r.every(x => x.segmento === 'CONSOLIDADO' && x.corte === 5 && x.base === 'ATENDIDAS' && x.consolidado));
});

test('mês e semana: soma dos dias consolidados e INCOMPLETO quando a TEL só cobre parte', () => {
  const r = C.consolidar(rows);
  const m = r.find(x => x.tipo === 'MES');
  assert.strictEqual(m.dias, 3);                                                 // só os dias com TEL (16 a 18), não os 5 do C.O.
  assert.strictEqual(m.diasPeriodo, 30);
  assert.strictEqual(m.completo, false);
  assert.strictEqual(m.volume, 300 + 300 + 10);
  assert.strictEqual(m.total, 280 + 280 + 10);
  assert.strictEqual(m.ate, 140 + 160 + 5);
  assert.strictEqual(m.periodo, 'NOV*');
  // a parte de cada um nos mesmos 3 dias (e não nos 5 dias do C.O. no mês)
  assert.deepStrictEqual(m.co, { volume: 200 + 200 + 0, total: 180 + 180 + 0, ate: 90 + 100 + 0 });
  assert.deepStrictEqual(m.tel, { volume: 210, total: 210, ate: 115 });
  assert.strictEqual(m.co.total + m.tel.total, m.total);
  const s = r.find(x => x.tipo === 'SEMANA');
  assert.strictEqual(s.dias, 3);
  assert.strictEqual(s.completo, false);
});

test('período completo dos dois: sem asterisco e igual à soma das linhas do período', () => {
  const dias = [1, 2, 3, 4, 5, 6, 7];
  const rs = [...dias.map(d => dia('B2C', d, 100, 90, 80)), ...dias.map(d => dia('B2C_TEL', d, 50, 50, 40)),
    sem('B2C', '1101', 700, 630, 560), sem('B2C_TEL', '1101', 350, 350, 280)];
  rs.filter(x => x.tipo === 'SEMANA').forEach(x => { x.completo = true; x.dias = 7; });
  const s = C.consolidar(rs).find(x => x.tipo === 'SEMANA');
  assert.strictEqual(s.completo, true);
  assert.strictEqual(s.dias, 7);
  assert.strictEqual(s.total, 630 + 350);
  assert.strictEqual(s.ate, 560 + 280);
  assert.ok(!/\*$/.test(s.periodo));
});

test('sem a TEL, só a TEL, corte ou base diferentes: nada de consolidado', () => {
  assert.deepStrictEqual(C.consolidar(rows.filter(r => r.segmento === 'B2C')), []);
  assert.deepStrictEqual(C.consolidar(rows.filter(r => r.segmento === 'B2C_TEL')), []);
  assert.deepStrictEqual(C.consolidar(rows.map(r => r.segmento === 'B2C_TEL' ? { ...r, corte: 3 } : r)), []);
  assert.deepStrictEqual(C.consolidar(rows.map(r => r.segmento === 'B2C_TEL' ? { ...r, base: 'RECEBIDAS' } : r)), []);
  assert.deepStrictEqual(C.consolidar(null), []);
  assert.deepStrictEqual(C.consolidar([]), []);
});

test('não mexe nas linhas de entrada', () => {
  const antes = JSON.stringify(rows);
  C.consolidar(rows);
  assert.strictEqual(JSON.stringify(rows), antes);
});

test('mesma versão do app, do service worker e dos outros módulos; arquivo no CORE e no index.html', () => {
  const ler = f => fs.readFileSync(__dirname + '/../' + f, 'utf8');
  const app = ler('app.js').match(/APP_VERSION = '([^']+)'/)[1];
  assert.deepStrictEqual([C.VERSAO, ler('sw.js').match(/VERSION = '([^']+)'/)[1], ler('sistemas.js').match(/VERSAO = '([^']+)'/)[1], ler('frentes.js').match(/VERSAO = '([^']+)'/)[1]], [app, app, app, app]);
  assert.ok(ler('sw.js').includes("'consolidado.js'"));
  assert.ok(ler('index.html').includes('<script src="consolidado.js"></script>'));
});
