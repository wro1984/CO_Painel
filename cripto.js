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
  // aceita com ou sem traços e em minúsculas (o alfabeto não tem O, 0, I nem 1, que se confundem)
  const normCodigo = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const codigoValido = c => normCodigo(c).length === 16 && [...normCodigo(c)].every(ch => ALFABETO.includes(ch));

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

  async function abrirComChave(pacote, chaveUsuario, id) {
    const a = pacote.acessos[id];
    if (!a) { const e = new Error('Seu acesso a este painel foi removido. Se precisar, peça de novo no MAPI.'); e.code = 'sem_acesso'; throw e; }
    let rawK;
    try { rawK = await C.subtle.decrypt({ name: 'AES-GCM', iv: b64(a.iv) }, chaveUsuario, b64(a.ct)); }
    catch (e) { const er = new Error('Código de acesso incorreto.'); er.code = 'codigo'; throw er; }
    const k = await C.subtle.importKey('raw', rawK, 'AES-GCM', false, ['decrypt']);
    let txt;
    try { txt = await C.subtle.decrypt({ name: 'AES-GCM', iv: b64(pacote.dados.iv) }, k, b64(pacote.dados.ct)); }
    catch (e) { const er = new Error('Os dados publicados estão corrompidos.'); er.code = 'corrompido'; throw er; }
    return new Uint8Array(txt);
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

  // próximos acessos: usa a credencial guardada
  async function abrir(pacote, cred) {
    conferePacote(pacote);
    const a = pacote.acessos[cred.id];
    // o salt da pessoa só muda se o acesso foi refeito no MAPI: aí o código antigo não vale mais
    if (a && a.salt !== cred.salt) { const e = new Error('Seu acesso foi renovado no MAPI. Entre de novo com o código novo.'); e.code = 'sem_acesso'; throw e; }
    return abrirComChave(pacote, cred.chave, cred.id);
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

  const api = { entrar, abrir, lerCred, salvarCred, apagarCred, idDe, normMatricula, normCodigo, codigoValido, ALFABETO };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.NSCripto = api;
})(typeof self !== 'undefined' ? self : this);
