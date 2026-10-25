/* ===== Connections hub (Settings) — gaya katalog koneksi: Browse / Connected / Manage =====
   Prinsip: hanya koneksi yang NYATA; yang belum dibangun diberi label "Segera hadir" tanpa tombol palsu.
   Tidak ada rahasia di browser: yang ditampilkan hanya status dan ID non-rahasia.
   Kartu pengaturan lama (Database, AI, Tuntas, Groundwork, Polaris One) tidak ditulis ulang: node aslinya
   dipindahkan ke jendela "Manage" (ID dan handler tetap), lalu dikembalikan ke penampungan tersembunyi saat ditutup. */
(function(){
'use strict';
if(window.CXH) return;
var D = document;
function $(i){ return D.getElementById(i); }
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function ls(k){ try{ return localStorage.getItem(k) || ''; }catch(e){ return ''; } }
var ST = { tab:'browse', q:'', cat:'all', open:null, moved:[], lastFocus:null, msg:'' };

/* ---------- definisi koneksi ---------- */
var CATS = [['all','Semua'],['Data','Data'],['Activity','Activity & Action'],['Project','Project'],['AI','AI'],['Katalog','Katalog part']];
function dbStatus(){
  var p = $('statusPill'); if(!p) return { k:'muted', t:'Mode pratinjau', on:false };
  var on = p.classList.contains('ok');
  return { k:on ? 'ok' : 'muted', t:on ? 'Terhubung' : 'Belum terhubung', on:on };
}
function intStatus(sys){
  var s = null; try{ s = window.INTUI && INTUI.status && INTUI.status(sys); }catch(e){}
  if(!s) return { k:'muted', t:'Belum masuk', on:false };
  if(s.on) return { k:'ok', t:'Terhubung' + (s.email ? ' · ' + s.email : ''), on:true };
  return { k:'muted', t:s.hasCfg ? 'Belum masuk' : 'Belum diatur', on:false };
}
function polStatus(){
  var s = null; try{ s = window.AC6 && AC6.polaris && AC6.polaris.status && AC6.polaris.status(); }catch(e){}
  if(!s) return { k:'muted', t:'Belum diatur', on:false };
  return { k:s.k === 'ok' ? 'ok' : s.k === 'warn' ? 'warn' : 'muted', t:({ 'Not set up':'Belum diatur', 'Disconnected':'Terputus', 'Paused':'Dijeda', 'Needs attention':'Perlu perhatian', 'Connected':'Terhubung' })[s.t] || s.t, on:s.k === 'ok' || s.k === 'warn' };
}
var CONNS = [
  { id:'database', name:'Database (Supabase)', mono:'DB', cat:'Data', type:'Penyimpanan', status:dbStatus,
    desc:'Tempat seluruh data Altair Auto disimpan: kendaraan, Work Order, Job Card, biaya, dan dokumen.',
    caps:['Menyimpan dan membaca semua data Altair Auto','Login pengguna dan persetujuan admin (Supabase Auth)','Penyimpanan berkas: dokumen OEM, spec sheet, catatan teknis','Setup skema lewat SQL yang Anda jalankan sendiri di SQL Editor'],
    access:['Memakai Project URL dan anon key (publik); yang membatasi akses adalah login dan aturan RLS','Service-role key tidak pernah dipakai atau disimpan di aplikasi','Perubahan skema hanya terjadi jika Anda menjalankan SQL-nya sendiri'],
    nodes:function(){ var p = $('statusPill'); return [p && p.parentNode, $('setupBox')]; },
    forget:{ label:'Putuskan dari perangkat ini', note:'Menghapus URL dan anon key yang tersimpan di browser ini. Data di database TIDAK dihapus.', run:function(){ if(typeof clearConnection === 'function') clearConnection(); } },
    stored:function(){ var u = ls('ik_sbUrl'); return u ? { what:'Project URL + anon key', host:u.replace(/^https?:\/\//, '').replace(/\/.*$/, '') } : null; } },
  { id:'tuntas', name:'Tuntas / VEGA TEMPUS', mono:'TU', cat:'Activity', type:'Dua arah', status:function(){ return intStatus('tuntas'); },
    desc:'Pusat Activity & Action. Work Order menjadi Activity, Task menjadi Action; biaya dapat dikirim ke Ledger.',
    caps:['Kirim Work Order → Activity dan Task → Action (memperbarui, tidak membuat ganda)','Tarik status dan progress dari Tuntas','Terima Activity dari Tuntas sebagai Work Order','Sinkron otomatis, termasuk biaya dan anggaran (opsional, Anda yang menyalakan)'],
    access:['Masuk dengan akun Tuntas Anda; aturan keamanan baris Tuntas tetap berlaku','Password tidak disimpan di perangkat','Hanya admin Altair Auto yang dapat mengubah koneksi ini'],
    mode:'tuntas', nodes:function(){ return [$('intSettingsBox')]; },
    forget:{ label:'Keluar dan hapus pengaturan', note:'Keluar dari Tuntas dan menghapus URL, key, dan email yang tersimpan di browser ini. Data di Tuntas tidak diubah.', run:function(){ if(window.INTUI && INTUI.forget) return INTUI.forget('tuntas'); } },
    stored:function(){ return storedInt('tuntas'); } },
  { id:'groundwork', name:'Groundwork', mono:'GW', cat:'Project', type:'Dua arah', status:function(){ return intStatus('groundwork'); },
    desc:'Sumber Project paket A##/C##/D##-Check. Hanya Project yang boleh Anda akses di Groundwork yang terlihat.',
    caps:['Mencari Project di Groundwork','Impor Project sebagai paket A##/C##/D##-Check','Perbarui paket dari Groundwork','Kirim balik status dan prioritas item (butuh akses Edit di Groundwork)'],
    access:['Masuk dengan akun Groundwork Anda; aturan keamanan di Groundwork tetap berlaku','Password tidak disimpan di perangkat','Hanya admin Altair Auto yang dapat mengubah koneksi ini'],
    mode:'groundwork', nodes:function(){ return [$('intSettingsBox')]; },
    forget:{ label:'Keluar dan hapus pengaturan', note:'Keluar dari Groundwork dan menghapus URL, key, dan email yang tersimpan di browser ini. Data di Groundwork tidak diubah.', run:function(){ if(window.INTUI && INTUI.forget) return INTUI.forget('groundwork'); } },
    stored:function(){ return storedInt('groundwork'); } },
  { id:'polaris', name:'Polaris One', mono:'PO', cat:'Activity', type:'Dua arah', status:polStatus,
    desc:'Pusat Activity & Action. Hanya item yang sengaja Anda tandai (area Work atau Freelance) yang dikirim.',
    caps:['Bertukar Activity (Project → Sub-Activity) dan Action (Task)','Event ditandatangani dengan rahasia bersama; semua kegagalan autentikasi dijawab 401 generik','Antrean dengan percobaan ulang untuk event yang gagal','Jeda dan putuskan kapan saja tanpa menghapus data lokal'],
    access:['Hanya item dengan area Work/Freelance dan sinkron aktif yang dikirim','Rahasia bersama POLARIS_HUB_SECRET hanya sebagai environment secret di server; tidak pernah di browser, repositori, atau log','Data pribadi atau non-kerja tidak dikirim'],
    nodes:function(){ return [$('polarisCard')]; },
    extra:function(){ var l = null; try{ l = window.AC6 && AC6.polaris && AC6.polaris.info && AC6.polaris.info(); }catch(e){} if(!l) return ''; return '<div class="cx-kv"><div><span>Link ID (bukan rahasia)</span><code>' + esc(l.id || '(belum dibuat — buat di bagian Manage)') + '</code></div><div><span>Alamat hub di project ini</span><code>' + esc(l.hub || '–') + '</code></div></div><div class="cx-row"><button type="button" class="ghost" data-cx="copy-link">Salin Link ID</button><button type="button" class="ghost" data-cx="copy-hub">Salin alamat hub</button></div>'; },
    forget:{ label:'Putuskan (Disconnect)', note:'Memutus tautan: Polaris One akan mendapat 401 sampai Anda menyambungkannya lagi. Data lokal tetap utuh. Perlu klik dua kali.', run:function(){ if(window.AC6 && AC6.polaris && AC6.polaris.disconnect) return AC6.polaris.disconnect(); } },
    stored:function(){ return null; } },
  { id:'ai', btn:'Setup', name:'AI Global Research', mono:'AI', cat:'AI', type:'Opsional', status:function(){ return { k:'muted', t:'Opsional', on:false }; },
    desc:'Tombol “AI Auto-Analysis” di tiap tahap Problem Analysis (RCA, FEA, FMEA, PICA, Kaizen, Monitoring, PDCA).',
    caps:['Analisa otomatis tiap tahap Problem Analysis lewat Edge Function ai-problem-research','Hasil hanya usulan; keputusan tetap di tangan Anda'],
    access:['ANTHROPIC_API_KEY hanya sebagai secret Edge Function di server; tidak pernah di browser atau repositori','Aplikasi hanya memanggil fungsi di project Supabase Anda'],
    nodes:function(){ return [$('aiSetupBox')]; }, forget:null, stored:function(){ return null; } },
  { id:'altairordo', planned:true, name:'AltairOrdo — Project Management', mono:'AO', cat:'Project', type:'Rencana',
    desc:'Pusat Project Management. Integrasi langsung belum dibangun; untuk sekarang Project masuk lewat Groundwork.',
    plan:['Belum ada kode, endpoint, atau data yang dijalankan untuk koneksi ini.','Sementara: gunakan koneksi Groundwork untuk menerima Project dan mengirim balik status.','Saat dibangun, mengikuti aturan yang sama: rahasia hanya di server, tanda tangan diverifikasi sebelum akses database, tidak ada hapus permanen.'] },
  { id:'partscatalog', planned:true, name:'Katalog part (API eksternal)', mono:'PC', cat:'Katalog', type:'Rencana',
    desc:'Auto Parts Catalog (RapidAPI), Car API, dan backend auto-parts-catalog. Menunggu keputusan dan akses dari pemilik.',
    plan:['Belum ada adapter live. Semua panggilan nanti lewat proxy server berotorisasi; RAPIDAPI_KEY hanya sebagai environment secret server.','Article ID penyedia bukan nomor OEM; hasil cross-reference tidak otomatis fitment terverifikasi.','Bila kunci API pernah terlihat di gambar atau tangkapan layar, anggap bocor dan minta pemilik me-rotate lewat kanal aman.'],
    table:true }
];
function byId(id){ for(var i = 0; i < CONNS.length; i++) if(CONNS[i].id === id) return CONNS[i]; return null; }
function storedInt(sys){
  var raw = {}; try{ raw = JSON.parse(ls('ik_int_cfg') || '{}') || {}; }catch(e){}
  var c = raw[sys]; if(!c || !(c.url || c.key || c.email)) return null;
  var host = String(c.url || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return { what:'URL + publishable key' + (c.email ? ' + email' : ''), host:host || '(kosong)', email:c.email || '' };
}
function connected(c){ return !c.planned && c.status().on; }

/* ---------- CSS ---------- */
function css(){
  if($('cxCss')) return; var s = D.createElement('style'); s.id = 'cxCss';
  s.textContent = '' +
  '#cxHub{margin:0 0 22px}#cxHub h2.cx-h{margin:0 0 4px;font-size:20px}#cxHub .cx-sub{margin:0 0 14px;color:var(--text-dim);font-size:13.5px}' +
  '.cx-tabs{display:flex;gap:4px;border-bottom:1px solid var(--border);margin-bottom:14px;overflow-x:auto}' +
  '.cx-tabs button{background:none;border:0;border-bottom:2px solid transparent;padding:9px 12px;font:inherit;font-weight:600;font-size:14px;color:var(--text-dim);cursor:pointer;white-space:nowrap}' +
  '.cx-tabs button[aria-selected=true]{color:var(--text);border-bottom-color:var(--accent)}' +
  '.cx-badge{display:inline-block;min-width:18px;padding:0 6px;margin-left:6px;border-radius:999px;background:var(--surface-2);font-size:12px;line-height:18px;text-align:center;color:var(--text)}' +
  '.cx-bar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.cx-bar input,.cx-bar select{font:inherit;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);min-width:0}.cx-bar input{flex:1;min-width:180px}' +
  '.cx-grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}' +
  '.cx-card{border:1px solid var(--border);border-radius:var(--radius);background:var(--surface);padding:14px;display:flex;flex-direction:column;gap:8px}' +
  '.cx-card.planned{border-style:dashed}.cx-card .cx-top{display:flex;gap:10px;align-items:center}.cx-card h3{margin:0;font-size:15px;line-height:1.25}.cx-card p{margin:0;font-size:13px;color:var(--text-dim);flex:1}' +
  '.cx-mono{flex:none;width:36px;height:36px;border-radius:9px;background:var(--accent-soft);color:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;letter-spacing:.3px}' +
  '.cx-meta{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.cx-card .cx-act{display:flex;gap:8px;align-items:center;justify-content:space-between;margin-top:2px}' +
  '.cx-empty{padding:26px;text-align:center;color:var(--text-dim);border:1px dashed var(--border);border-radius:var(--radius)}' +
  '.cx-tbl{width:100%;border-collapse:collapse;font-size:13.5px}.cx-tbl th,.cx-tbl td{text-align:left;padding:9px 8px;border-bottom:1px solid var(--border);vertical-align:middle}.cx-tbl th{font-size:12px;color:var(--text-dim);font-weight:600}' +
  '.cx-sec{margin:0 0 18px}.cx-sec h3{margin:0 0 8px;font-size:15px}.cx-sec .hint{margin:4px 0 0}' +
  '.cx-pm{position:fixed;inset:0;z-index:9000;background:rgba(10,18,26,.55);display:flex;align-items:flex-start;justify-content:center;padding:0 12px 4vh;overflow:auto}' +
  '.cx-dlg{background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:14px;width:min(860px,100%);margin-top:4vh;box-shadow:0 18px 60px rgba(0,0,0,.35);outline:none}' +
  '.cx-dh{display:flex;gap:12px;align-items:center;padding:16px 18px;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--bg);border-radius:14px 14px 0 0;z-index:1}' +
  '.cx-dh h2{margin:0;font-size:18px}.cx-dh .cx-x{margin-left:auto;background:none;border:0;font-size:24px;line-height:1;cursor:pointer;color:var(--text-dim);padding:4px 8px}' +
  '.cx-db{padding:18px}.cx-ul{margin:0;padding-left:20px;font-size:14px;line-height:1.6}' +
  '.cx-two{display:grid;gap:18px;grid-template-columns:1fr 1fr}@media(max-width:640px){.cx-two{grid-template-columns:1fr}}' +
  '.cx-kv{display:grid;gap:8px;margin:8px 0}.cx-kv>div{display:flex;flex-direction:column;gap:2px;font-size:13px}.cx-kv span{color:var(--text-dim);font-size:12px}.cx-kv code{word-break:break-all}' +
  '.cx-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}' +
  '.cx-manage{border:1px solid var(--border);border-radius:12px;padding:12px;background:var(--surface)}.cx-manage .card{margin-bottom:12px}' +
  '.cx-dz{border:1px solid var(--danger-bg);background:transparent;border-radius:12px;padding:12px}.cx-dz h3{color:var(--danger-ink)}' +
  '@media(max-width:480px){.cx-tabs button{padding:9px 8px;font-size:13px}.cx-card .cx-act{flex-wrap:wrap}}#cxStash{display:none}html.cx-lock{overflow:hidden}' +
  '#intSettingsBox.cx-m-tuntas>:nth-child(2),#intSettingsBox.cx-m-tuntas>:nth-child(4){display:none}' +
  '#intSettingsBox.cx-m-groundwork>:nth-child(1),#intSettingsBox.cx-m-groundwork>:nth-child(3),#intSettingsBox.cx-m-groundwork>:nth-child(5){display:none}';
  D.head.appendChild(s);
}

/* ---------- penampungan & pemindahan node ---------- */
function stash(){
  var st = $('cxStash'); if(st) return st;
  var pan = $('panel-settings'); if(!pan) return null;
  st = D.createElement('div'); st.id = 'cxStash'; st.hidden = true; pan.appendChild(st); return st;
}
function relocate(){
  var st = stash(); if(!st) return;
  var pc = $('polarisCard'); if(pc && pc.parentNode && pc.parentNode.id === 'ac6SettingsRoot') st.appendChild(pc);
  ['statusPill'].forEach(function(id){ var e = $(id); if(e && e.parentNode && e.parentNode.parentNode && e.parentNode.parentNode.id === 'panel-settings' && !(e.parentNode.id)) st.appendChild(e.parentNode); });
  ['setupBox','aiSetupBox','intSettingsBox'].forEach(function(id){ var e = $(id); if(e && e.parentNode && e.parentNode.id === 'panel-settings') st.appendChild(e); });
}
function moveIn(host, c){
  var list = (c.nodes ? c.nodes() : []).filter(Boolean), ok = 0;
  list.forEach(function(n){
    if(!n || n.contains(host)) return;
    ST.moved.push({ node:n, parent:n.parentNode, next:n.nextSibling }); host.appendChild(n); ok++;
    if(n.tagName === 'DETAILS') n.setAttribute('open', '');
  });
  var box = $('intSettingsBox'); if(box){ box.classList.remove('cx-m-tuntas', 'cx-m-groundwork'); if(c.mode) box.classList.add('cx-m-' + c.mode); }
  return ok;
}
function moveBack(){
  var box = $('intSettingsBox'); if(box) box.classList.remove('cx-m-tuntas', 'cx-m-groundwork');
  var st = stash();
  ST.moved.reverse().forEach(function(m){ try{ (m.parent && m.parent.isConnected ? m.parent : st).appendChild(m.node); }catch(e){ if(st) st.appendChild(m.node); } });
  ST.moved = [];
}

/* ---------- tampilan ---------- */
function pill(s){ return '<span class="status-pill ' + esc(s.k) + '"><span class="dot"></span>' + esc(s.t) + '</span>'; }
function plannedPill(){ return '<span class="status-pill muted">Segera hadir</span>'; }
function card(c){
  var s = c.planned ? null : c.status();
  var btn = c.planned
    ? '<button type="button" class="ghost" data-cx="open" data-id="' + c.id + '">Lihat rencana</button>'
    : (s.on ? '<button type="button" class="ghost" data-cx="open" data-id="' + c.id + '">Manage</button>' : '<button type="button" class="' + (c.btn ? 'ghost' : 'primary') + '" data-cx="open" data-id="' + c.id + '">' + (c.btn || 'Connect') + '</button>');
  return '<div class="cx-card' + (c.planned ? ' planned' : '') + '" data-cx-card="' + c.id + '"><div class="cx-top"><div class="cx-mono" aria-hidden="true">' + esc(c.mono) + '</div><h3>' + esc(c.name) + '</h3></div>' +
    '<p>' + esc(c.desc) + '</p><div class="cx-act"><div class="cx-meta">' + (c.planned ? plannedPill() : pill(s)) + '</div>' + btn + '</div></div>';
}
function match(c){
  if(ST.cat !== 'all' && c.cat !== ST.cat) return false;
  var q = ST.q.trim().toLowerCase(); if(!q) return true;
  return (c.name + ' ' + c.desc + ' ' + c.cat + ' ' + c.type).toLowerCase().indexOf(q) >= 0;
}
function paneBrowse(){
  var list = CONNS.filter(match);
  var h = '<div class="cx-bar"><input type="search" id="cxQ" placeholder="Cari koneksi" aria-label="Cari koneksi" value="' + esc(ST.q) + '"><select id="cxCat" aria-label="Kategori">' +
    CATS.map(function(k){ return '<option value="' + k[0] + '"' + (ST.cat === k[0] ? ' selected' : '') + '>' + esc(k[1]) + '</option>'; }).join('') + '</select></div>';
  if(!list.length) return h + '<div class="cx-empty">Tidak ada koneksi yang cocok.</div>';
  return h + '<div class="cx-grid">' + list.map(card).join('') + '</div><p class="hint" style="margin-top:12px;">Kartu bergaris putus-putus belum dibangun. Tidak ada koneksi yang berpura-pura aktif.</p>';
}
function paneConnected(){
  var list = CONNS.filter(connected);
  if(!list.length) return '<div class="cx-empty">Belum ada koneksi yang aktif. Buka tab Browse Connections dan pilih Connect.</div>';
  return '<div class="cx-grid">' + list.map(card).join('') + '</div>';
}
function paneManage(){
  var rows = CONNS.map(function(c){
    var st = c.planned ? plannedPill() : pill(c.status());
    var dir = c.type;
    return '<tr><td><strong>' + esc(c.name) + '</strong><div class="hint" style="margin:2px 0 0">' + esc(c.cat) + '</div></td><td>' + st + '</td><td>' + esc(dir) + '</td><td>' + (c.planned ? 'Belum ada' : 'Admin') + '</td><td style="text-align:right"><button type="button" class="ghost" data-cx="open" data-id="' + c.id + '">' + (c.planned ? 'Detail' : 'Manage') + '</button></td></tr>';
  }).join('');
  var stored = CONNS.filter(function(c){ return !c.planned && c.stored && c.stored(); });
  var sh = stored.length ? '<table class="cx-tbl"><thead><tr><th>Koneksi</th><th>Yang tersimpan di browser ini</th><th></th></tr></thead><tbody>' + stored.map(function(c){
    var v = c.stored(); return '<tr><td><strong>' + esc(c.name) + '</strong></td><td>' + esc(v.what) + ' &middot; <code>' + esc(v.host) + '</code></td><td style="text-align:right"><button type="button" class="danger" data-cx="forget" data-id="' + c.id + '">Hapus dari perangkat</button></td></tr>';
  }).join('') + '</tbody></table>' : '<p class="hint">Tidak ada kredensial koneksi yang tersimpan di browser ini.</p>';
  return '<div class="cx-sec"><h3>Semua koneksi</h3><div style="overflow-x:auto"><table class="cx-tbl"><thead><tr><th>Koneksi</th><th>Status</th><th>Arah</th><th>Dikelola oleh</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>' +
    '<div class="cx-sec"><h3>Kredensial di perangkat ini</h3>' + sh + '<p class="hint">Hanya URL, key publik (anon/publishable), dan email yang disimpan. Password tidak pernah disimpan. Rahasia server (POLARIS_HUB_SECRET, ANTHROPIC_API_KEY, RAPIDAPI_KEY) tidak ada di browser ini dan tidak bisa dilihat dari sini.</p></div>' +
    '<div class="cx-sec"><h3>Izin</h3><ul class="cx-ul"><li>Halaman Settings, termasuk semua koneksi di sini, hanya dapat dibuka dan diubah oleh admin.</li><li>Pengguna lain tidak melihat menu Settings sama sekali (diatur di Users &amp; Access).</li><li>Sinkron otomatis, pilihan item untuk Polaris One, dan sakelar lain berada di jendela Manage koneksi masing-masing.</li></ul></div>';
}
function renderHub(){
  var h = $('cxHub'); if(!h) return;
  var n = CONNS.filter(connected).length;
  var t = [['browse','Browse Connections'],['connected','Connected' + '<span class="cx-badge">' + n + '</span>'],['manage','Manage']];
  var fq = D.activeElement && D.activeElement.id === 'cxQ' ? D.activeElement.selectionStart : null;
  var ae = D.activeElement, fk = (ae && ae.getAttribute && ae.getAttribute('data-cx') && ae.getAttribute('data-id') && h.contains(ae)) ? '[data-cx="' + ae.getAttribute('data-cx') + '"][data-id="' + ae.getAttribute('data-id') + '"]' : null;
  h.innerHTML = '<h2 class="cx-h">Connections</h2><p class="cx-sub">Hubungkan Altair Auto dengan database, Tuntas, Groundwork, dan Polaris One. Semua pengaturan koneksi ada di sini; kartu lain di bawah adalah akun, pengguna, backup, dan aplikasi.</p>' +
    '<div class="cx-tabs" role="tablist" aria-label="Connections">' + t.map(function(x){ return '<button type="button" role="tab" id="cxTab-' + x[0] + '" aria-selected="' + (ST.tab === x[0]) + '" data-cx="tab" data-id="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
    '<div role="tabpanel" aria-labelledby="cxTab-' + ST.tab + '">' + (ST.tab === 'browse' ? paneBrowse() : ST.tab === 'connected' ? paneConnected() : paneManage()) + '</div>';
  if(fk){ var fe = h.querySelector(fk); if(fe) try{ fe.focus(); }catch(e){} }
  if(fq != null){ var q = $('cxQ'); if(q){ q.focus(); try{ q.setSelectionRange(fq, fq); }catch(e){} } }
}

/* ---------- jendela Manage ---------- */
function list(a){ return '<ul class="cx-ul">' + a.map(function(x){ return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>'; }
function openModal(id){
  var c = byId(id); if(!c) return; closeModal(true);
  ST.open = id; ST.lastFocus = D.activeElement; lfSel = '[data-cx="open"][data-id="' + id + '"]';
  var ov = D.createElement('div'); ov.className = 'cx-pm'; ov.id = 'cxModal';
  var s = c.planned ? null : c.status();
  var body = '';
  if(c.planned){
    body = '<div class="cx-sec"><h3>Status</h3><p style="margin:0">Belum dibangun. Tidak ada yang berjalan untuk koneksi ini.</p></div><div class="cx-sec"><h3>Rencana dan catatan</h3>' + list(c.plan) + '</div>';
    if(c.table){
      var as = (window.AC6 && AC6.apiStatus) || [];
      body += '<div class="cx-sec"><h3>Status integrasi</h3><div style="overflow-x:auto"><table class="cx-tbl"><thead><tr><th>Komponen</th><th>Status</th><th>Catatan</th></tr></thead><tbody>' + as.map(function(a){ return '<tr><td>' + esc(a[0]) + '</td><td><span class="status-pill muted">' + esc(a[1]) + '</span></td><td class="hint">' + esc(a[2]) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
    }
  } else {
    body = '<div class="cx-sec"><p style="margin:0">' + esc(c.desc) + '</p></div>' +
      '<div class="cx-two"><div class="cx-sec"><h3>Capabilities</h3>' + list(c.caps) + '</div><div class="cx-sec"><h3>Access</h3>' + list(c.access) + '</div></div>' +
      (c.extra ? '<div class="cx-sec"><h3>ID koneksi (non-rahasia)</h3>' + c.extra() + '</div>' : '') +
      '<div class="cx-sec"><h3>Manage</h3><div class="cx-manage" id="cxHost"></div></div>' +
      (c.forget && (s.on || (c.stored && c.stored())) ? '<div class="cx-dz"><h3>Danger zone</h3><p class="hint" style="margin:0 0 8px">' + esc(c.forget.note) + '</p><button type="button" class="danger" data-cx="forget" data-id="' + c.id + '">' + esc(c.forget.label) + '</button></div>' : '');
  }
  ov.innerHTML = '<div class="cx-dlg" role="dialog" aria-modal="true" aria-labelledby="cxTitle" tabindex="-1"><div class="cx-dh"><div class="cx-mono" aria-hidden="true">' + esc(c.mono) + '</div><div><h2 id="cxTitle">' + esc(c.name) + '</h2><div class="cx-meta" id="cxMStatus" style="margin-top:4px">' + (c.planned ? plannedPill() : pill(s)) + '</div></div><button type="button" class="cx-x" data-cx="close" aria-label="Tutup">&times;</button></div><div class="cx-db">' + body + '</div></div>';
  D.body.appendChild(ov); D.documentElement.classList.add('cx-lock');
  if(!c.planned){
    var host = $('cxHost'), n = moveIn(host, c);
    if(!n) host.innerHTML = '<p class="hint" style="margin:0">' + (c.id === 'database' || c.id === 'ai' ? 'Mode pratinjau: tidak ada koneksi Supabase di sini. Pada versi yang terhubung, pengaturan ini muncul di jendela ini.' : 'Pengaturan koneksi ini tidak tersedia di tampilan ini.') + '</p>';
  }
  var dlg = ov.querySelector('.cx-dlg'); try{ dlg.focus(); }catch(e){}
}
function closeModal(silent){
  var ov = $('cxModal'); moveBack();
  if(ov) ov.remove(); D.documentElement.classList.remove('cx-lock');
  var lf = ST.lastFocus; ST.open = null; ST.lastFocus = null;
  if(!silent){ renderHub(); try{ var t = (lf && lf.isConnected) ? lf : (lf && lf.getAttribute && lf.getAttribute('data-id') ? D.querySelector('[data-cx="' + lf.getAttribute('data-cx') + '"][data-id="' + lf.getAttribute('data-id') + '"]') : null); if(!t && lfSel) t = D.querySelector(lfSel); if(t) t.focus(); }catch(e){} }
}
function refreshModalStatus(){
  if(!ST.open) return; var c = byId(ST.open), el = $('cxMStatus'); if(c && !c.planned && el) el.innerHTML = pill(c.status());
}

/* ---------- aksi ---------- */
function copy(t){ try{ navigator.clipboard.writeText(t); }catch(e){} }
function forget(id){
  var c = byId(id); if(!c || !c.forget) return;
  var r = c.forget.run(); Promise.resolve(r).then(function(){ later(); });
}
function onClick(e){
  var b = e.target.closest ? e.target.closest('[data-cx]') : null;
  if(!b) { var ov = $('cxModal'); if(ov && e.target === ov) closeModal(); return; }
  var a = b.getAttribute('data-cx'), id = b.getAttribute('data-id');
  if(a === 'tab'){ ST.tab = id; renderHub(); }
  else if(a === 'open') openModal(id);
  else if(a === 'close') closeModal();
  else if(a === 'forget'){
    var c = byId(id); if(!c) return;
    if(b.getAttribute('data-armed') !== '1' && c.id !== 'polaris'){
      b.setAttribute('data-armed', '1'); b.textContent = 'Klik lagi untuk konfirmasi'; setTimeout(function(){ if(b.isConnected){ b.removeAttribute('data-armed'); b.textContent = c.forget.label; } }, 5000); return;
    }
    forget(id);
  }
  else if(a === 'copy-link'){ var l = AC6.polaris.info && AC6.polaris.info(); if(l) copy(l.id || ''); }
  else if(a === 'copy-hub'){ var l2 = AC6.polaris.info && AC6.polaris.info(); if(l2) copy(l2.hub || ''); }
}
function onInput(e){
  if(e.target.id === 'cxQ'){ ST.q = e.target.value; renderHub(); }
}
function onChange(e){ if(e.target.id === 'cxCat'){ ST.cat = e.target.value; renderHub(); } }
function onKey(e){
  if(!ST.open) return;
  if(e.key === 'Escape'){ e.stopPropagation(); closeModal(); return; }
  if(e.key === 'Tab'){
    var dlg = D.querySelector('#cxModal .cx-dlg'); if(!dlg) return;
    var f = [].filter.call(dlg.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex="0"]'), function(x){ return x.offsetParent !== null; });
    if(!f.length) return; var first = f[0], last = f[f.length - 1];
    if(e.shiftKey && (D.activeElement === first || D.activeElement === dlg)){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && D.activeElement === last){ e.preventDefault(); first.focus(); }
  }
}

/* ---------- pembaruan status (debounce) ---------- */
var tm = null, lfSel = '';
function later(){ if(tm) return; tm = setTimeout(function(){ tm = null; relocate(); watch(); if(!ST.open) renderHub(); else refreshModalStatus(); }, 120); }

/* ---------- pasang ---------- */
function mount(){
  var pan = $('panel-settings'); if(!pan || $('cxHub')) return;
  css();
  var hub = D.createElement('section'); hub.id = 'cxHub'; hub.setAttribute('aria-label', 'Connections');
  var root = $('ac6SettingsRoot'); pan.insertBefore(hub, root || pan.children[2] || null);
  /* judul/teks lama yang digantikan hub */
  [].forEach.call(pan.querySelectorAll(':scope > .sec-title, :scope > p'), function(e){
    var t = (e.textContent || '').trim();
    if(t === 'Database' || t === 'Integrasi API' || /^Hubungkan Altair Auto dengan Tuntas/.test(t)) e.hidden = true;
  });
  var dbCard = [].filter.call(pan.querySelectorAll(':scope > .card'), function(e){ var h = e.querySelector('h2'); return h && h.textContent.trim() === 'Database'; })[0];
  if(dbCard){ dbCard.hidden = true; dbCard.setAttribute('data-cx-note', 'preview'); }
  var pd = pan.querySelector('.page-desc'); if(pd) pd.textContent = 'Connections (database, AI, Tuntas, Groundwork, Polaris One) ada di bagian atas. Di bawahnya: akun, pengguna, backup, dan aplikasi (PWA). Halaman lain hanya menampilkan data dan memberi tautan kembali ke sini.';
  relocate(); renderHub();
  var root2 = $('ac6SettingsRoot');
  try{
    MO = new MutationObserver(later);
    if(root2) MO.observe(root2, { childList:true });
    MO.observe(pan, { attributes:true, attributeFilter:['hidden'] });
    watch();
  }catch(e){}
  D.addEventListener('click', onClick); D.addEventListener('input', onInput); D.addEventListener('change', onChange); D.addEventListener('keydown', onKey, true);
}
var MO = null, seen = [];
function watch(){
  if(!MO) return;
  ['statusPill','intSettingsBox','polarisCard','cxStash'].forEach(function(id){
    var e = $(id); if(!e || seen.indexOf(e) >= 0) return; seen.push(e);
    if(id === 'statusPill') MO.observe(e, { attributes:true, attributeFilter:['class'] }); else MO.observe(e, { childList:true });
  });
}
function boot(){ try{ mount(); }catch(e){ try{ console.warn('CXH', e); }catch(x){} } }
window.CXH = { open:openModal, close:closeModal, render:renderHub, refresh:later, conns:CONNS, state:ST };
if(D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot); else boot();
})();
