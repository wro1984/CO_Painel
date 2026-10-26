/* NS Painel — acesso e criptografia dos dados publicados.
 *
 * O site é público (GitHub Pages gratuito), então o dados.json publicado vem
 * criptografado. Quem não tem um acesso aprovado no MAPI só vê bytes sem sentido.
 *
 * FORMATO do dados.json (gerado pelo MAPI, ver ferramentas/pacote.py):
 *   kdf      PBKDF2-SHA256 com `iter` iterações
 *   acessos  { <id>: {salt, iv, ct} }   id = SHA-256("co-painel:" + MATRÍCULA)
 *            ct = a chave dos dados, cifrada (AES-GCM) com a chave da pessoa
 *   dados    {iv, ct}                    o TXT, cifrado (AES-GCM) com a chave dos dados
 *   sistemas {iv, ct}  (OPCIONAL)       o TXT de problemas sistêmicos (mesmo formato do sistemas.txt),
 *                                       cifrado com a MESMA chave dos dados e um iv próprio.
 *                                       Sem o campo, o app não mostra o card de sistemas.
 *
 * A chave da pessoa sai do código de acesso (PBKDF2 com o salt dela). Depois do
 * primeiro login fica guardada no aparelho como CryptoKey NÃO extraível: o código
 * em si não é guardado, e o script não consegue ler a chave, só usá-la.
 *
 * A chave dos dados muda a cada publicação. Quem teve o acesso removido no MAPI
 * some de `acessos` e deixa de abrir os dados novos.
 */
(function (root) {
  'use strict';

  const C = (root.crypto && root.crypto.subtle) ? root.crypto : null;
  const enc = new TextEncoder();
  const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

  const normMatricula = m => String(m || '').trim().toUpperCase().replace(/\s+/g, '');
  // A chave pode ser o código sorteado (XXXX-XXXX-XXXX-XXXX) ou uma palavra definida pelo admin.
  // Sem acento, maiúscula e só letras/números: "Girassól 26" e "girassol26" são a mesma chave.
  // Precisa ser IGUAL a norm_codigo do MAPI (ns_painel.py) e de ferramentas/pacote.py.
  // (filtra ANTES de passar para maiúscula: "ß".toUpperCase() vira "SS" no JS e não no Python)
  const normCodigo = c => String(c || '').normalize('NFD').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const CHAVE_MINIMA = 4;
  const codigoValido = c => normCodigo(c).length >= CHAVE_MINIMA && normCodigo(c).length <= 64;

  async function idDe(matricula) {
    return hex(await C.subtle.digest('SHA-256', enc.encode('co-painel:' + normMatricula(matricula))));
  }

  async function chaveDoCodigo(codigo, salt, iter) {
    const base = await C.subtle.importKey('raw', enc.encode(normCodigo(codigo)), 'PBKDF2', false, ['deriveKey']);
    return C.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter },
      base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  }

  function conferePacote(p) {
    if (!p || p.app !== 'co-painel' || p.v !== 1 || !p.acessos || !p.dados || !p.kdf) throw new Error('dados.json em formato desconhecido.');
  }

  // chave dos dados (aberta com a chave da pessoa)
  async function chaveDosDados(pacote, chaveUsuario, id) {
    const a = pacote.acessos[id];
    if (!a) { const e = new Error('Seu acesso a este painel foi removido. Se precisar, peça de novo no MAPI.'); e.code = 'sem_acesso'; throw e; }
    let rawK;
    try { rawK = await C.subtle.decrypt({ name: 'AES-GCM', iv: b64(a.iv) }, chaveUsuario, b64(a.ct)); }
    catch (e) { const er = new Error('Chave de acesso incorreta.'); er.code = 'codigo'; throw er; }
    return C.subtle.importKey('raw', rawK, 'AES-GCM', false, ['decrypt']);
  }
  async function decifrar(k, campo, msg) {
    try { return new Uint8Array(await C.subtle.decrypt({ name: 'AES-GCM', iv: b64(campo.iv) }, k, b64(campo.ct))); }
    catch (e) { const er = new Error(msg); er.code = 'corrompido'; throw er; }
  }
  async function abrirComChave(pacote, chaveUsuario, id) {
    const k = await chaveDosDados(pacote, chaveUsuario, id);
    return decifrar(k, pacote.dados, 'Os dados publicados estão corrompidos.');
  }

  // primeiro acesso: matrícula + código -> credencial para guardar no aparelho
  async function entrar(pacote, matricula, codigo) {
    if (!C) throw new Error('Este navegador não tem criptografia (abra pelo endereço https do app).');
    conferePacote(pacote);
    const id = await idDe(matricula);
    const a = pacote.acessos[id];
    if (!a) { const e = new Error('Matrícula sem acesso aprovado. Peça o acesso no MAPI.'); e.code = 'sem_acesso'; throw e; }
    const chave = await chaveDoCodigo(codigo, b64(a.salt), pacote.kdf.iter);
    const bytes = await abrirComChave(pacote, chave, id);
    return { cred: { id, matricula: normMatricula(matricula), chave, salt: a.salt, desde: Date.now() }, bytes };
  }

  // ---------- login único pelo HUB (wro1984.github.io) ----------
  // O HUB guarda a credencial da pessoa no IndexedDB "co-hub-acesso" deste mesmo endereço. Quem tem este app no perfil
  // do HUB recebe, no campo `hub` do dados.json, a chave dos dados embrulhada com a chave do HUB:
  //   hub {acessos: {<id do HUB>: {salt, iv, ct}}}    id = SHA-256("hub:" + MATRÍCULA); salt = o do HUB
  // O app só LÊ a credencial do HUB, nunca a apaga nem a copia: sair de todos os apps é no HUB.
  const lerCredHub = () => new Promise(res => {
    if (typeof indexedDB === 'undefined') { res(null); return; }
    let rq;
    try { rq = indexedDB.open('co-hub-acesso', 1); } catch (e) { res(null); return; }
    rq.onupgradeneeded = () => { try { rq.transaction.abort(); } catch (e) { /* segue */ } };   // sem HUB neste aparelho: não cria nada
    rq.onerror = () => res(null);
    rq.onsuccess = () => {
      const d = rq.result;
      try {
        const g = d.transaction('cred', 'readonly').objectStore('cred').get('atual');
        g.onsuccess = () => {
          d.close();
          const c = g.result;
          res(c && c.id && c.chave && c.salt ? { via: 'hub', id: c.id, matricula: c.matricula, chave: c.chave, salt: c.salt, desde: c.desde } : null);
        };
        g.onerror = () => { d.close(); res(null); };
      } catch (e) { d.close(); res(null); }
    };
  });
  const semAcesso = msg => { const e = new Error(msg); e.code = 'sem_acesso'; return e; };
  async function chaveDosDadosHub(pacote, cred) {
    const a = pacote.hub && pacote.hub.acessos && pacote.hub.acessos[cred.id];
    if (!a) throw semAcesso('Seu perfil no HUB não inclui este painel. Fale com o administrador, ou entre com a chave própria do painel.');
    if (a.salt !== cred.salt) throw semAcesso('Sua chave do HUB foi trocada. Abra o HUB e entre de novo.');
    let rawK;
    try { rawK = await C.subtle.decrypt({ name: 'AES-GCM', iv: b64(a.iv) }, cred.chave, b64(a.ct)); }
    catch (e) { throw semAcesso('Sua chave do HUB não abre este painel. Abra o HUB e entre de novo.'); }
    return C.subtle.importKey('raw', rawK, 'AES-GCM', false, ['decrypt']);
  }

  // próximos acessos: usa a credencial guardada (a própria do painel ou a do HUB)
  async function abrir(pacote, cred) {
    conferePacote(pacote);
    if (cred && cred.via === 'hub') return decifrar(await chaveDosDadosHub(pacote, cred), pacote.dados, 'Os dados publicados estão corrompidos.');
    const a = pacote.acessos[cred.id];
    // o salt da pessoa só muda se o acesso foi refeito no MAPI: aí o código antigo não vale mais
    if (a && a.salt !== cred.salt) { const e = new Error('Sua chave foi trocada. Entre de novo com a chave nova.'); e.code = 'sem_acesso'; throw e; }
    return abrirComChave(pacote, cred.chave, cred.id);
  }

  // campo opcional "sistemas": null quando o dados.json não traz o campo
  async function abrirSistemas(pacote, cred) {
    conferePacote(pacote);
    const s = pacote.sistemas;
    if (s == null) return null;
    if (typeof s !== 'object' || typeof s.iv !== 'string' || typeof s.ct !== 'string') { const e = new Error('Os dados de sistemas publicados estão em formato desconhecido.'); e.code = 'corrompido'; throw e; }
    if (cred && cred.via === 'hub') return decifrar(await chaveDosDadosHub(pacote, cred), s, 'Os dados de sistemas publicados estão corrompidos.');
    const a = pacote.acessos[cred.id];
    if (a && a.salt !== cred.salt) { const e = new Error('Sua chave foi trocada. Entre de novo com a chave nova.'); e.code = 'sem_acesso'; throw e; }
    const k = await chaveDosDados(pacote, cred.chave, cred.id);
    return decifrar(k, s, 'Os dados de sistemas publicados estão corrompidos.');
  }

  // ---------- credencial no aparelho (IndexedDB guarda CryptoKey sem expor a chave) ----------
  const DB = 'co-painel-acesso', ST = 'cred';
  function db() {
    return new Promise((res, rej) => {
      const rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore(ST);
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    });
  }
  async function op(mode, fn) {
    const d = await db();
    return new Promise((res, rej) => {
      const t = d.transaction(ST, mode); let out;
      const r = fn(t.objectStore(ST)); if (r) r.onsuccess = () => { out = r.result; };
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error);
    });
  }
  const lerCred = () => op('readonly', s => s.get('atual')).catch(() => null);
  const salvarCred = c => op('readwrite', s => s.put(c, 'atual'));
  const apagarCred = () => op('readwrite', s => s.delete('atual'));

  const api = { entrar, abrir, abrirSistemas, lerCred, lerCredHub, salvarCred, apagarCred, idDe, normMatricula, normCodigo, codigoValido, ALFABETO };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.NSCripto = api;
})(typeof self !== 'undefined' ? self : this);
