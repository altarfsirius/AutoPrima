/* ===== Altair Auto · Akun, Login wajib, Create New Account, Admin & fasilitas per user ===== */
(function(){
'use strict';
if(window.__agLoaded) return; window.__agLoaded = true;
const D = document;
const $ = id => D.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const MOCK = !D.querySelector('script[src*="supabase-js"]');           // pratinjau tanpa database: akun demo di memori
const LV = { none:0, view:1, edit:2 };
const SQL_MIGRATION = @@MIGRATION_SQL@@;
const SQL_RLS = @@RLS_SQL@@;
const SQL_RLS_RB = @@RLS_RB_SQL@@;

/* tabel -> menu yang boleh menulis (sama dengan app_table_rule di rls_fasilitas_optin.sql) */
const W_ALL = ['workorder','program','planboard','project','usage','parts','inspeksi','kerusakan','event'];
const RISK = ['risiko','kerusakan'], DOC = ['dokumen','parts','workorder','tool'];
const TABLE_W = {
  kendaraan:['home','usage'], work_order:W_ALL, job_card:W_ALL, project:['project','program'], project_item:['project','program'],
  plan_schedule:['planboard'], plan_setting:['planboard'], plan_audit:['planboard'],
  installed_component:['parts','partlib','workorder','kerusakan','program'], part_order_plan:['parts','partlib','workorder','program'],
  part_library:['partlib','parts','workorder'], parts_catalog_ref:['dokumen','partlib'], manual_reference:['dokumen','partlib'],
  oem_document:DOC, technical_record:DOC, spec_sheet_item:DOC, spec_sheet_attachment:DOC, engineering_spec:DOC,
  defect_log:['kerusakan','inspeksi'], fmea_risk:RISK, rca_analysis:RISK, problem_case:RISK, fea_item:RISK, pica_item:RISK, kaizen_item:RISK, monitoring_parameter:RISK, pdca_cycle:RISK,
  electrical_capacity:['ela'], electrical_load_item:['ela'], cost_budget_item:['biaya','workorder','usage'],
  inspection_item:['inspeksi'], inspection_session:['inspeksi'], tool:['tool'], workshop_resource:['mitra'],
  purchase_appraisal:['appraisal'], purchase_appraisal_item:['appraisal'], governance_document:['governance','dasar'], touring_event:['event']
};
const ADMIN_ONLY = ['integration_link','integration_log','polaris_link','polaris_outbox','polaris_nonce','polaris_rate','app_profile','app_admin_email','app_table_rule'];
const BUCKET_W = DOC;

const ST = { mode:'boot', msg:null, busy:false, me:null, user:null, legacy:false, fresh:false, resolving:null, recovery:false,
  client:null, sub:null, users:[], usersMsg:null, rowMsg:{}, openRows:new Set(), pw:{}, cool:0, lastCheck:0, mockClient:null, err:null };

/* ---------- daftar fasilitas (menu) ---------- */
function facGroups(){
  const groups = (typeof NAV_GROUPS !== 'undefined') ? NAV_GROUPS : [];
  const labels = (typeof PANEL_LABELS !== 'undefined') ? PANEL_LABELS : {};
  const meta = (typeof GROUP_META !== 'undefined') ? GROUP_META : {};
  return groups.filter(g => g.key !== 'settings').map(g => ({ key:g.key, label:(meta[g.key] && meta[g.key].label) || g.key, items:g.panels.map(p => ({ key:p, label:labels[p] || p })) }));
}
function allPanels(){ const o = []; facGroups().forEach(g => g.items.forEach(i => o.push(i.key))); return o; }
function level(p){
  if(!ST.me) return 2;
  if(ST.legacy || ST.me.role === 'admin') return 2;
  if(p === 'settings') return 0;
  return LV[(ST.me.facilities || {})[p]] || 0;
}
function firstAllowed(){ return allPanels().find(p => level(p) >= 1) || null; }
function canWrite(table){
  if(!ST.me || ST.legacy || ST.me.role === 'admin') return true;
  if(ADMIN_ONLY.indexOf(table) >= 0) return false;
  const w = TABLE_W[table]; if(!w) return true;                       // tabel di luar peta: tidak diblokir di sisi aplikasi
  return w.some(f => level(f) >= 2);
}

/* ---------- penerjemah galat ---------- */
function tr(e){
  const m = String((e && (e.message || e.error_description)) || e || ''); const c = String(e && (e.code || e.error_code) || '');
  if(/Invalid login credentials|invalid_credentials/i.test(m + c)) return 'Email atau password salah.';
  if(/Email not confirmed|email_not_confirmed/i.test(m + c)) return 'Email belum dikonfirmasi. Buka tautan konfirmasi di email Anda, lalu Login.';
  if(/already registered|user_already_exists/i.test(m + c)) return 'Jika email ini belum terdaftar, tautan konfirmasi dikirim. Bila sudah terdaftar, silakan Login.';
  if(/signups? (are )?(not allowed|disabled)|signup_disabled/i.test(m + c)) return 'Pendaftaran akun baru dinonaktifkan di proyek ini. Hubungi admin.';
  if(/rate limit|over_email_send_rate_limit|over_request_rate_limit|too many/i.test(m + c)) return 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.';
  if(/Password should be|weak_password/i.test(m + c)) return 'Password terlalu lemah. Gunakan minimal 8 karakter dengan huruf dan angka.';
  if(/valid email|email_address_invalid|Unable to validate email/i.test(m + c)) return 'Format email tidak valid.';
  if(/same_password|different from the old/i.test(m + c)) return 'Password baru harus berbeda dari yang lama.';
  if(/Failed to fetch|NetworkError|Load failed|fetch failed/i.test(m)) return 'Tidak dapat menjangkau server. Periksa koneksi internet lalu coba lagi.';
  if(/AG_READONLY/.test(c)) return m;
  return m ? ('Gagal: ' + m) : 'Terjadi kesalahan.';
}
/* profil terakhir disimpan di perangkat agar tampilan tetap terbuka saat offline (hanya UI; database tetap menegakkan akses) */
const PK = 'ag_prof_v1';
function cacheProf(row){ try{ localStorage.setItem(PK, JSON.stringify({ row, ts:Date.now() })); }catch(e){} }
function clearProf(){ try{ localStorage.removeItem(PK); }catch(e){} }
function cachedProf(uid){ try{ const o = JSON.parse(localStorage.getItem(PK) || 'null'); if(o && o.row && o.row.status === 'active' && (!uid || o.row.user_id === uid) && Date.now() - o.ts < 7 * 864e5) return o.row; }catch(e){} return null; }
const isNet = e => /Failed to fetch|NetworkError|Load failed|fetch failed|AuthRetryableFetchError/i.test(String((e && (e.message || e.name)) || e || '')) || (typeof navigator !== 'undefined' && navigator.onLine === false);
const missingTable = e => /42P01|PGRST205|PGRST200|does not exist|schema cache|Could not find the table/i.test(String((e && (e.code || '')) + ' ' + (e && e.message || '')));

/* ---------- adaptor pratinjau (tanpa database) ---------- */
function makeMock(){
  const users = [
    { id:'u-admin', email:'admin@demo.test', password:'Admin#1234', full_name:'Admin Demo', role:'admin', status:'active', facilities:{}, created_at:'2026-10-01T00:00:00Z' },
    { id:'u-user', email:'user@demo.test', password:'User#1234', full_name:'User Demo', role:'user', status:'active', facilities:{ home:'edit', workorder:'view', program:'view', kpi:'view' }, created_at:'2026-10-02T00:00:00Z' }
  ];
  let session = null; const subs = [];
  const emit = evt => subs.forEach(f => setTimeout(() => f(evt, session), 0));
  const pub = u => ({ id:u.id, email:u.email, user_metadata:{ full_name:u.full_name } });
  const auth = {
    async getSession(){ return { data:{ session } }; },
    async signInWithPassword(a){ const u = users.find(x => x.email === String(a.email).toLowerCase()); if(!u || u.password !== a.password) return { data:{}, error:{ message:'Invalid login credentials' } }; session = { user:pub(u) }; emit('SIGNED_IN'); return { data:{ user:session.user, session }, error:null }; },
    async signUp(a){ const em = String(a.email).toLowerCase(); if(users.some(x => x.email === em)) return { data:{ user:{ identities:[] }, session:null }, error:null };
      const u = { id:'u-' + Math.random().toString(36).slice(2, 8), email:em, password:a.password, full_name:(a.options && a.options.data && a.options.data.full_name) || '', role:'user', status:'pending', facilities:{}, created_at:new Date().toISOString() };
      users.push(u); session = { user:pub(u) }; emit('SIGNED_IN'); return { data:{ user:session.user, session }, error:null }; },
    async signOut(){ session = null; emit('SIGNED_OUT'); return { error:null }; },
    async resetPasswordForEmail(){ return { data:{}, error:null }; },
    async updateUser(a){ if(!session) return { data:{}, error:{ message:'Auth session missing' } }; const u = users.find(x => x.id === session.user.id); if(a.password) u.password = a.password; return { data:{ user:session.user }, error:null }; },
    onAuthStateChange(cb){ subs.push(cb); return { data:{ subscription:{ unsubscribe(){ const i = subs.indexOf(cb); if(i >= 0) subs.splice(i, 1); } } } }; }
  };
  function builder(table){
    const q = { op:'select', patch:null, eqs:[], one:false };
    const run = async () => {
      if(table !== 'app_profile') return { data:null, error:{ message:'relation "' + table + '" does not exist', code:'42P01' } };
      const me = session && users.find(x => x.id === session.user.id); const isAdm = me && me.role === 'admin' && me.status === 'active';
      let rows = users.filter(u => isAdm || (me && u.id === me.id)); q.eqs.forEach(e => { rows = rows.filter(r => (e[0] === 'user_id' ? r.id : r[e[0]]) === e[1]); });
      const out = r => Object.assign({}, r, { user_id:r.id, password:undefined });
      if(q.op === 'update'){ if(!isAdm) return { data:null, error:null }; rows.forEach(r => { Object.assign(r, q.patch); }); return { data:q.one ? (rows[0] ? out(rows[0]) : null) : rows.map(out), error:null }; }
      return { data:q.one ? (rows[0] ? out(rows[0]) : null) : rows.map(out), error:null };
    };
    const b = { select(){ return b; }, eq(k, v){ q.eqs.push([k, v]); return b; }, order(){ return b; }, update(p){ q.op = 'update'; q.patch = p; return b; }, maybeSingle(){ q.one = true; return run(); }, then(res, rej){ return run().then(res, rej); } };
    return b;
  }
  return { auth, from:builder, __mock:true, supabaseUrl:'', supabaseKey:'' };
}

function C(){ if(MOCK){ if(!ST.mockClient) ST.mockClient = makeMock(); return ST.mockClient; } return (typeof sb !== 'undefined' && sb) ? sb : null; }

/* ---------- CSS ---------- */
function css(){
  if($('agCss')) return;
  const s = D.createElement('style'); s.id = 'agCss';
  s.textContent = `
html.ag-lock body > *:not(#agGate):not(script):not(style):not(link){display:none !important}
#agGate{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:calc(env(safe-area-inset-top,0px) + 16px) 16px calc(env(safe-area-inset-bottom,0px) + 16px);background:linear-gradient(160deg,#0b2447 0%,#19376d 55%,#0a6280 100%);overflow:auto;font-family:'IBM Plex Sans',system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
#agGate[hidden]{display:none}
#agGate .ag-card{width:100%;max-width:420px;background:#fff;color:#161f29;border-radius:18px;padding:24px 22px 20px;box-shadow:0 20px 60px rgba(0,0,0,.35);margin:auto}
#agGate .ag-brand{display:flex;align-items:center;gap:12px;margin-bottom:14px}
#agGate .ag-brand img{width:48px;height:48px;border-radius:12px;object-fit:cover;background:#fff}
#agGate .ag-brand b{display:block;font-size:19px;line-height:1.15;color:#0b2447}
#agGate .ag-brand span{display:block;font-size:12px;color:#57636f;margin-top:2px}
#agGate h2{font-size:18px;margin:6px 0 4px;color:#0b2447}
#agGate p.ag-hint{font-size:13px;line-height:1.45;color:#57636f;margin:0 0 12px}
#agGate label{display:block;font-size:12.5px;font-weight:600;color:#3b4652;margin:10px 0 4px}
#agGate input{width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:11px 12px;border:1px solid #c9d1d9;border-radius:10px;background:#fff;color:#161f29}
#agGate input:focus{outline:2px solid #0a6280;outline-offset:1px;border-color:#0a6280}
#agGate .ag-pw{position:relative}
#agGate .ag-pw input{padding-right:64px}
#agGate .ag-eye{position:absolute;right:6px;top:50%;transform:translateY(-50%);background:transparent;border:0;color:#0a6280;font-weight:600;font-size:12.5px;padding:8px;cursor:pointer;border-radius:8px}
#agGate .ag-btn{display:block;width:100%;box-sizing:border-box;font:inherit;font-size:15px;font-weight:700;padding:12px 14px;border-radius:10px;border:1px solid #0a6280;background:#0a6280;color:#fff;cursor:pointer;margin-top:14px}
#agGate .ag-btn.alt{background:#fff;color:#0a6280}
#agGate .ag-btn[disabled]{opacity:.55;cursor:default}
#agGate .ag-link{background:none;border:0;color:#0a6280;font:inherit;font-size:13px;font-weight:600;cursor:pointer;padding:6px 2px;text-decoration:underline}
#agGate .ag-row{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:8px}
#agGate .ag-msg{font-size:13px;line-height:1.4;border-radius:10px;padding:9px 11px;margin:0 0 10px}
#agGate .ag-err{background:#fbe8e5;color:#ab3324}
#agGate .ag-ok{background:#e4f7ec;color:#187a44}
#agGate .ag-warn{background:#fdf0da;color:#7a4e06}
#agGate .ag-demo{font-size:12px;background:#e3f1f5;color:#0b4a60;border-radius:10px;padding:8px 10px;margin-bottom:10px;line-height:1.4}
#agGate .ag-spin{width:28px;height:28px;border:3px solid #d8dee5;border-top-color:#0a6280;border-radius:50%;animation:agspin 1s linear infinite;margin:14px auto}
@keyframes agspin{to{transform:rotate(360deg)}}
#agGate .ag-big{font-size:34px;text-align:center;margin:6px 0}
#agChip{position:fixed;top:calc(env(safe-area-inset-top,0px) + 8px);right:12px;z-index:90;display:none;align-items:center;gap:8px;background:rgba(255,255,255,.94);color:#0b2447;border:1px solid #c9d1d9;border-radius:999px;padding:4px 10px 4px 4px;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.12);max-width:60vw}
#agChip.on{display:flex}
#agChip .av{width:26px;height:26px;border-radius:50%;background:#0a6280;color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;flex:none}
#agChip .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#agChip .dot{width:9px;height:9px;border-radius:50%;background:#e0902a;flex:none}
@media (max-width:600px){#agChip .nm{display:none}#agChip{padding:4px}}
@media (min-width:1025px){#agChip{display:none !important}}
#agNavAcct{display:flex;align-items:center;gap:10px;width:100%;text-align:left}
#agNavAcct .av{width:26px;height:26px;border-radius:50%;background:#0a6280;color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;flex:none}
#agNavAcct .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;font-size:13px}
#agNavAcct .dot{width:9px;height:9px;border-radius:50%;background:#e0902a;flex:none}
#agMenu{position:fixed;top:calc(env(safe-area-inset-top,0px) + 46px);right:12px;z-index:200;width:min(300px,calc(100vw - 24px));background:#fff;color:#161f29;border:1px solid #c9d1d9;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.2);padding:12px;display:none;font-size:13px}
#agMenu.on{display:block}
#agMenu button{font:inherit;font-weight:600;font-size:13px;border-radius:9px;padding:8px 10px;border:1px solid #c9d1d9;background:#fff;color:#0b2447;cursor:pointer;margin:8px 6px 0 0}
#agMenu .pill{display:inline-block;font-size:11.5px;font-weight:700;padding:2px 8px;border-radius:999px;background:#e8ecf0;color:#3b4652;margin-right:4px}
#agToast{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 24px);z-index:10001;background:#0b2447;color:#fff;border-radius:10px;padding:10px 14px;font-size:13px;max-width:min(92vw,420px);display:none}
.ag-ribbon{background:#fdf0da;color:#7a4e06;border:1px solid #e6c36a;border-radius:10px;padding:8px 12px;font-size:13px;margin:0 0 12px}
.ag-ro button.primary,.ag-ro button[type=submit],.ag-ro .danger,.ag-ro button.warn{opacity:.4;pointer-events:none}
#agAdminCard .ag-u{border:1px solid var(--border,#d8dee5);border-radius:12px;padding:10px 12px;margin-top:10px;background:var(--surface,#fff)}
#agAdminCard .ag-uh{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}
#agAdminCard .ag-uh b{font-size:14px}
#agAdminCard .ag-uh small{display:block;color:var(--text-dim,#57636f);word-break:break-all}
#agAdminCard .ag-fac{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:6px 12px;margin-top:8px}
#agAdminCard .ag-fac label{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13px}
#agAdminCard select{font:inherit;font-size:13px;padding:5px 6px;border-radius:8px;border:1px solid var(--border,#c9d1d9);background:#fff;color:inherit}
#agAdminCard .ag-g{margin-top:10px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--text-dim,#57636f)}
#agAdminCard .ag-act{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
#agAdminCard pre{max-height:180px;overflow:auto;font-size:11.5px;background:#f4f6f8;border-radius:8px;padding:8px}
`;
  D.head.appendChild(s);
}

/* ---------- gate ---------- */
function gate(){
  let g = $('agGate');
  if(!g){
    g = D.createElement('div'); g.id = 'agGate'; g.setAttribute('role', 'dialog'); g.setAttribute('aria-modal', 'true'); g.setAttribute('aria-labelledby', 'agTitle');
    D.body.appendChild(g);
    g.addEventListener('submit', onSubmit);
    g.addEventListener('click', onClick);
    g.addEventListener('keydown', e => {
      if(e.key !== 'Tab') return; const f = Array.from(g.querySelectorAll('input,button,a[href],select')).filter(x => !x.disabled && x.offsetParent !== null);
      if(!f.length) return; const first = f[0], last = f[f.length - 1];
      if(e.shiftKey && D.activeElement === first){ e.preventDefault(); last.focus(); } else if(!e.shiftKey && D.activeElement === last){ e.preventDefault(); first.focus(); }
    });
  }
  return g;
}
const val = id => { const e = $(id); return e ? e.value : ''; };
function msgHtml(){ return ST.msg ? `<div class="ag-msg ag-${ST.msg.k}" role="${ST.msg.k === 'err' ? 'alert' : 'status'}">${esc(ST.msg.t)}</div>` : ''; }
function pwField(id, label, auto, extra){
  const shown = !!ST.pw[id];
  return `<label for="${id}">${label}</label><div class="ag-pw"><input id="${id}" name="${id}" type="${shown ? 'text' : 'password'}" autocomplete="${auto}" ${extra || ''}><button type="button" class="ag-eye" data-act="eye" data-for="${id}" aria-pressed="${shown}" aria-label="${shown ? 'Hide' : 'Show'} password">${shown ? 'Hide' : 'Show'}</button></div>`;
}
function view(){
  const logo = (D.querySelector('.brand-logo') || {}).src || '';
  const head = `<div class="ag-brand">${logo ? `<img alt="" src="${esc(logo)}">` : ''}<div><b>Altair Auto</b><span>Program perawatan kendaraan</span></div></div>`;
  const dis = ST.busy ? 'disabled' : '';
  const demo = MOCK ? '<div class="ag-demo"><b>Pratinjau</b> (tanpa database, akun tidak disimpan).<br>Admin: <code>admin@demo.test</code> / <code>Admin#1234</code><br>User: <code>user@demo.test</code> / <code>User#1234</code></div>' : '';
  const m = ST.mode; let body = '';
  if(m === 'boot') body = '<h2 id="agTitle">Memulai…</h2><div class="ag-spin" aria-hidden="true"></div><p class="ag-hint" style="text-align:center">Memeriksa sesi Anda.</p>';
  else if(m === 'config') body = `<h2 id="agTitle">Connect to Database</h2><p class="ag-hint">Masukkan Project URL dan Publishable key Supabase Anda. Nilai ini disimpan hanya di perangkat ini.</p>${msgHtml()}
    <form data-form="config" novalidate><label for="agUrl">Project URL</label><input id="agUrl" type="url" inputmode="url" autocomplete="off" placeholder="https://xxxx.supabase.co" value="${esc(val('agUrl'))}">
    <label for="agKey">Publishable key</label><input id="agKey" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="sb_publishable_…">
    <button class="ag-btn" type="submit" ${dis}>Connect</button></form>${ST.canBack ? '<div class="ag-row"><button type="button" class="ag-link" data-act="to-login">Back to Login</button></div>' : ''}`;
  else if(m === 'login') body = `<h2 id="agTitle">Login</h2><p class="ag-hint">Masuk untuk memakai Altair Auto.</p>${demo}${msgHtml()}
    <form data-form="login" novalidate><label for="agEmail">Email</label><input id="agEmail" type="email" inputmode="email" autocomplete="username" autocapitalize="off" spellcheck="false" value="${esc(ST.email || '')}">
    ${pwField('agPass', 'Password', 'current-password')}
    <button class="ag-btn" type="submit" ${dis}>Login</button></form>
    <button type="button" class="ag-btn alt" data-act="to-register" ${dis}>Create New Account</button>
    <div class="ag-row"><button type="button" class="ag-link" data-act="to-forgot">Forgot password?</button>${MOCK ? '' : '<button type="button" class="ag-link" data-act="to-config">Change database connection</button>'}</div>`;
  else if(m === 'register') body = `<h2 id="agTitle">Create New Account</h2><p class="ag-hint">Akun baru berstatus <b>menunggu persetujuan admin</b>. Menu yang boleh Anda pakai ditentukan admin.</p>${demo}${msgHtml()}
    <form data-form="register" novalidate><label for="agName">Full Name</label><input id="agName" type="text" autocomplete="name" value="${esc(ST.name || '')}">
    <label for="agEmail">Email</label><input id="agEmail" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" value="${esc(ST.email || '')}">
    ${pwField('agPass', 'Password', 'new-password')}
    ${pwField('agPass2', 'Confirm Password', 'new-password')}
    <p class="ag-hint" style="margin-top:6px">Minimal 8 karakter, berisi huruf dan angka.</p>
    <button class="ag-btn" type="submit" ${dis}>Create New Account</button></form>
    <div class="ag-row"><button type="button" class="ag-link" data-act="to-login">Back to Login</button></div>`;
  else if(m === 'forgot') body = `<h2 id="agTitle">Reset Password</h2><p class="ag-hint">Masukkan email akun Anda. Bila terdaftar, tautan untuk membuat password baru akan dikirim.</p>${msgHtml()}
    <form data-form="forgot" novalidate><label for="agEmail">Email</label><input id="agEmail" type="email" inputmode="email" autocomplete="username" autocapitalize="off" spellcheck="false" value="${esc(ST.email || '')}">
    <button class="ag-btn" type="submit" ${dis}>Send reset link</button></form><div class="ag-row"><button type="button" class="ag-link" data-act="to-login">Back to Login</button></div>`;
  else if(m === 'recovery') body = `<h2 id="agTitle">Set New Password</h2><p class="ag-hint">Buat password baru untuk akun Anda.</p>${msgHtml()}
    <form data-form="recovery" novalidate>${pwField('agPass', 'New Password', 'new-password')}${pwField('agPass2', 'Confirm Password', 'new-password')}
    <p class="ag-hint" style="margin-top:6px">Minimal 8 karakter, berisi huruf dan angka.</p><button class="ag-btn" type="submit" ${dis}>Save new password</button></form>`;
  else if(m === 'verify') body = `<div class="ag-big" aria-hidden="true">✉️</div><h2 id="agTitle" style="text-align:center">Cek email Anda</h2>${msgHtml()}<p class="ag-hint" style="text-align:center">Kami mengirim tautan konfirmasi ke <b>${esc(ST.email || '')}</b>. Setelah dikonfirmasi, Login. Akun baru tetap perlu persetujuan admin.</p>
    <button type="button" class="ag-btn" data-act="to-login">Back to Login</button>`;
  else if(m === 'pending' || m === 'noprofile') body = `<div class="ag-big" aria-hidden="true">⏳</div><h2 id="agTitle" style="text-align:center">${m === 'pending' ? 'Menunggu persetujuan admin' : 'Profil akun belum tersedia'}</h2>${msgHtml()}
    <p class="ag-hint" style="text-align:center">${m === 'pending' ? 'Akun <b>' + esc(ST.user && ST.user.email) + '</b> sudah dibuat. Admin perlu mengaktifkannya dan menentukan menu yang boleh Anda pakai.' : 'Akun <b>' + esc(ST.user && ST.user.email) + '</b> belum punya profil akses. Hubungi admin.'}</p>
    <button type="button" class="ag-btn" data-act="recheck" ${dis}>Check status</button><button type="button" class="ag-btn alt" data-act="logout">Logout</button>`;
  else if(m === 'disabled') body = `<div class="ag-big" aria-hidden="true">🚫</div><h2 id="agTitle" style="text-align:center">Akun dinonaktifkan</h2><p class="ag-hint" style="text-align:center">Akun <b>${esc(ST.user && ST.user.email)}</b> dinonaktifkan oleh admin. Hubungi admin bila ini keliru.</p>
    <button type="button" class="ag-btn" data-act="recheck" ${dis}>Check status</button><button type="button" class="ag-btn alt" data-act="logout">Logout</button>`;
  else if(m === 'nofac') body = `<div class="ag-big" aria-hidden="true">🔒</div><h2 id="agTitle" style="text-align:center">Belum ada menu yang diaktifkan</h2><p class="ag-hint" style="text-align:center">Akun Anda sudah aktif, tetapi admin belum memberi akses ke menu apa pun.</p>
    <button type="button" class="ag-btn" data-act="recheck" ${dis}>Check status</button><button type="button" class="ag-btn alt" data-act="logout">Logout</button>`;
  else if(m === 'error') body = `<div class="ag-big" aria-hidden="true">⚠️</div><h2 id="agTitle" style="text-align:center">Tidak dapat melanjutkan</h2>${msgHtml()}<p class="ag-hint" style="text-align:center">Akses tidak dibuka sampai pemeriksaan akun berhasil.</p>
    <button type="button" class="ag-btn" data-act="retry" ${dis}>Retry</button>${ST.user ? '<button type="button" class="ag-btn alt" data-act="logout">Logout</button>' : ''}`;
  return `<div class="ag-card">${head}${body}</div>`;
}
function render(focus){
  const g = gate(); g.hidden = false; g.innerHTML = view();
  if(focus !== false){ const f = g.querySelector('input:not([type=hidden])') || g.querySelector('.ag-btn'); if(f && !(D.activeElement && g.contains(D.activeElement))) try{ f.focus(); }catch(e){} }
}
function lock(mode, msg){
  if(mode !== 'boot') ST.sawGate = true;
  ST.mode = mode; ST.msg = msg || null; ST.busy = false;
  D.documentElement.classList.add('ag-lock'); window.__agReady = true;
  chip(false); render();
}
function unlock(){
  ST.mode = 'ok'; ST.msg = null; const g = $('agGate'); if(g){ g.hidden = true; g.innerHTML = ''; }
  D.documentElement.classList.remove('ag-lock'); chip(true);
}

/* ---------- aksi ---------- */
const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const strongPw = p => p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);
const redirect = () => /^https?:$/.test(location.protocol) ? (location.origin + location.pathname) : undefined;
function setBusy(b){ ST.busy = b; D.querySelectorAll('#agGate .ag-btn').forEach(x => { x.disabled = b; }); }
function keep(){ ST.email = val('agEmail').trim() || ST.email; if($('agName')) ST.name = val('agName'); }

async function onSubmit(ev){
  const f = ev.target.closest('form[data-form]'); if(!f) return; ev.preventDefault(); if(ST.busy) return;
  const kind = f.getAttribute('data-form'); keep();
  const c = C();
  if(kind === 'config') return doConfig();
  if(!c) return lock('config');
  const email = val('agEmail').trim().toLowerCase(), pw = val('agPass'), pw2 = val('agPass2');
  const fail = t => { ST.msg = { k:'err', t }; render(false); const e = $(kind === 'register' && val('agName').trim().length < 2 ? 'agName' : (kind === 'recovery' ? 'agPass' : 'agEmail')); if(e) try{ e.focus(); }catch(x){} };
  try{
    if(kind === 'login'){
      if(!validEmail(email)) return fail('Isi email dengan format yang benar.'); if(!pw) return fail('Isi password.');
      setBusy(true); const r = await c.auth.signInWithPassword({ email, password:pw }); if($('agPass')) $('agPass').value = '';
      if(r.error){ ST.msg = { k:'err', t:tr(r.error) }; setBusy(false); return render(); }
      ST.fresh = true; ST.msg = null; await resolve();
    } else if(kind === 'register'){
      const name = val('agName').trim();
      if(name.length < 2) return fail('Isi Full Name (minimal 2 karakter).'); if(!validEmail(email)) return fail('Isi email dengan format yang benar.');
      if(!strongPw(pw)) return fail('Password minimal 8 karakter dan harus berisi huruf serta angka.'); if(pw !== pw2) return fail('Confirm Password tidak sama dengan Password.');
      setBusy(true); const r = await c.auth.signUp({ email, password:pw, options:{ data:{ full_name:name }, emailRedirectTo:redirect() } });
      if($('agPass')) $('agPass').value = ''; if($('agPass2')) $('agPass2').value = '';
      if(r.error){ ST.msg = { k:'err', t:tr(r.error) }; setBusy(false); return render(); }
      if(r.data && r.data.session){ ST.fresh = true; await resolve(); }
      else { ST.email = email; setBusy(false); lock('verify'); }
    } else if(kind === 'forgot'){
      if(!validEmail(email)) return fail('Isi email dengan format yang benar.');
      if(Date.now() < ST.cool) return fail('Tunggu sebentar sebelum meminta tautan lagi.');
      setBusy(true); const r = await c.auth.resetPasswordForEmail(email, { redirectTo:redirect() }); setBusy(false);
      if(r.error && /rate|too many|over_/i.test(String(r.error.message) + String(r.error.code))) return fail(tr(r.error));
      ST.cool = Date.now() + 30000; ST.msg = { k:'ok', t:'Bila email terdaftar, tautan untuk membuat password baru sudah dikirim. Periksa juga folder spam.' }; render(false);
    } else if(kind === 'recovery'){
      if(!strongPw(pw)) return fail('Password minimal 8 karakter dan harus berisi huruf serta angka.'); if(pw !== pw2) return fail('Confirm Password tidak sama dengan Password.');
      setBusy(true); const r = await c.auth.updateUser({ password:pw }); if($('agPass')) $('agPass').value = ''; if($('agPass2')) $('agPass2').value = '';
      if(r.error){ ST.msg = { k:'err', t:tr(r.error) }; setBusy(false); return render(); }
      ST.recovery = false; ST.fresh = true; try{ history.replaceState(null, '', location.pathname + location.search); }catch(e){} await resolve();
    }
  }catch(e){ ST.msg = { k:'err', t:tr(e) }; setBusy(false); render(); }
}
function onClick(ev){
  const b = ev.target.closest('[data-act]'); if(!b) return; const a = b.getAttribute('data-act'); if(ST.busy && a !== 'eye') return;
  if(a === 'eye'){ const id = b.getAttribute('data-for'); const cur = {}; ['agEmail', 'agName', 'agPass', 'agPass2'].forEach(k => { cur[k] = val(k); });
    ST.pw[id] = !ST.pw[id]; keep(); render(false); Object.keys(cur).forEach(k => { if($(k) && cur[k]) $(k).value = cur[k]; }); const t = $(id); if(t) t.focus(); return; }
  keep();
  if(a === 'to-login'){ ST.msg = null; lock('login'); }
  else if(a === 'to-register'){ ST.msg = null; lock('register'); }
  else if(a === 'to-forgot'){ ST.msg = null; lock('forgot'); }
  else if(a === 'to-config'){ ST.canBack = true; lock('config'); }
  else if(a === 'recheck' || a === 'retry'){ resolve(); }
  else if(a === 'logout'){ logout(); }
}
function doConfig(){
  const url = val('agUrl').trim().replace(/\/+$/, ''), key = val('agKey').trim();
  if(!/^https:\/\/[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(url)) { ST.msg = { k:'err', t:'Project URL harus diawali https:// (contoh https://xxxx.supabase.co).' }; return render(false); }
  if(key.length < 20 || /\s/.test(key)) { ST.msg = { k:'err', t:'Isi Publishable key (kunci publik/anon, bukan service_role).' }; return render(false); }
  if(/service_role/i.test(key) || /"role"\s*:\s*"service_role"/.test((() => { try{ return atob(key.split('.')[1] || ''); }catch(e){ return ''; } })())) { ST.msg = { k:'err', t:'Kunci service_role tidak boleh dipakai di aplikasi. Gunakan Publishable/anon key.' }; return render(false); }
  if(!window.supabase){ ST.msg = { k:'err', t:'Pustaka Supabase belum termuat. Periksa koneksi lalu muat ulang.' }; return render(false); }
  if($('sbUrl')) $('sbUrl').value = url; if($('sbKey')) $('sbKey').value = key;
  ST.msg = null; ST.canBack = false;
  if(typeof saveConnection === 'function') saveConnection();          // menyimpan ke perangkat + initClient (dibungkus: attach)
  setTimeout(() => { if(ST.mode === 'config' || ST.mode === 'boot') resolve(); }, 0);
}
async function logout(){
  const c = C(); ST.busy = true; clearProf();
  try{ if(c && c.auth) await c.auth.signOut(); }catch(e){}
  if(ST.me || ST.user) { ST.me = null; ST.user = null; if(!MOCK) { location.reload(); return; } }
  ST.busy = false; lock('login');
}

/* ---------- pemeriksaan sesi dan profil ---------- */
async function loadProfile(c, user){
  const r = await c.from('app_profile').select('*').eq('user_id', user.id).maybeSingle();
  if(r.error){ if(missingTable(r.error)) return { legacy:true }; return { error:r.error }; }
  return { row:r.data || null };
}
function resolve(){
  if(ST.resolving) return ST.resolving;
  const pr = (async () => {
    const c = C();
    if(!c){ return lock('config'); }
    if(ST.recovery){ return lock('recovery'); }
    let s = null, r0 = null;
    try{ r0 = await c.auth.getSession(); s = r0 && r0.data && r0.data.session; }catch(e){ return lock('error', { k:'err', t:tr(e) }); }
    if(!s && r0 && r0.error && isNet(r0.error)){ const row = cachedProf(); if(row){ ST.user = { id:row.user_id, email:row.email }; ST.offline = true; return apply(ST.user, { row, cached:true }); } }
    if(!s){ ST.me = null; ST.user = null; if(['register', 'forgot', 'verify'].indexOf(ST.mode) >= 0){ ST.busy = false; render(false); return; } return lock('login', ST.msg); }
    ST.user = s.user;
    let p; try{ p = await loadProfile(c, s.user); }catch(e){ return lock('error', { k:'err', t:tr(e) }); }
    if(p.error){ if(isNet(p.error)){ const row = cachedProf(s.user.id); if(row){ ST.offline = true; return apply(s.user, { row, cached:true }); } } return lock('error', { k:'err', t:tr(p.error) }); }
    ST.offline = false;
    apply(s.user, p);
  })();
  ST.resolving = pr;                                   // dibersihkan setelah selesai (aman bila isi fungsi selesai sinkron)
  pr.then(() => { if(ST.resolving === pr) ST.resolving = null; }, () => { if(ST.resolving === pr) ST.resolving = null; });
  return pr;
}
function apply(user, p){
  const prev = ST.me;
  if(p.legacy){ ST.legacy = true; ST.me = { user_id:user.id, email:user.email, full_name:(user.user_metadata && user.user_metadata.full_name) || '', role:'admin', status:'active', facilities:{} }; }
  else {
    ST.legacy = false; const row = p.row;
    if(!row){ ST.me = null; clearProf(); return lock('noprofile'); }
    if(row.status === 'pending'){ ST.me = null; clearProf(); return lock('pending'); }
    if(row.status === 'disabled'){ ST.me = null; clearProf(); return lock('disabled'); }
    ST.me = row; if(!p.cached) cacheProf(row);
    if(row.role !== 'admin' && !allPanels().some(k => LV[(row.facilities || {})[k]] >= 1)){ ST.me = null; return lock('nofac'); }
  }
  const changed = !prev || JSON.stringify(prev.facilities) !== JSON.stringify(ST.me.facilities) || prev.role !== ST.me.role;
  const wasLocked = D.documentElement.classList.contains('ag-lock');
  unlock(); guard(C()); filterNav(); chipUpdate();
  const cur = (typeof currentPanel !== 'undefined') ? currentPanel : 'home';
  if(wasLocked || changed){ if(level(cur) < 1){ const n = firstAllowed(); if(n && typeof showPanel === 'function') window.showPanel(n); } else mark(cur); }
  if(ST.sawGate && !MOCK){ ST.sawGate = false; reinit(); } else ST.sawGate = false;     // data dimuat ulang bila sebelumnya terhalang gate
  if(p.cached) toast('Offline: memakai hak akses yang tersimpan. Data database tidak dapat dimuat sampai online.');
  if(ST.me.role === 'admin' && !ST.legacy && !p.cached) loadUsers();
  if(ST.legacy) renderAdmin();
}
function reinit(){
  const c = C(); if(!c || typeof initClient !== 'function') return;
  const url = c.supabaseUrl, key = c.supabaseKey; if(url && key) try{ window.initClient(url, key); }catch(e){}
}
async function recheck(){
  if(!ST.me && ST.mode !== 'pending' && ST.mode !== 'disabled' && ST.mode !== 'nofac') return;
  if(Date.now() - ST.lastCheck < 15000) return; ST.lastCheck = Date.now();
  const c = C(); if(!c) return;
  try{ const r = await c.auth.getSession(); const s = r && r.data && r.data.session; if(!s) return; const p = await loadProfile(c, s.user); if(p.error) return; ST.user = s.user; apply(s.user, p); }catch(e){}
}

/* ---------- penjaga tulis (sisi aplikasi) ---------- */
function denyObj(msg){
  const err = { message:msg, code:'AG_READONLY' };
  const o = new Proxy(function(){}, { get(_, k){ if(k === 'then') return (res, rej) => Promise.resolve({ data:null, error:err, count:null, status:403, statusText:'Forbidden' }).then(res, rej); if(k === 'catch') return fn => Promise.resolve({ data:null, error:err }).catch(fn); return () => o; }, apply(){ return o; } });
  return o;
}
function guard(c){
  if(!c || c.__agGuard === 'done' || c.__mock) return;
  c.__agGuard = 'done';
  const of = c.from.bind(c);
  c.from = function(t){
    const b = of(t);
    return new Proxy(b, { get(tg, k){
      if(['insert', 'update', 'upsert', 'delete'].indexOf(k) >= 0 && !canWrite(t)) return () => denyObj('Akses hanya lihat untuk data ini. Minta admin memberi level "View & edit" pada menu terkait.');
      const v = tg[k]; return typeof v === 'function' ? v.bind(tg) : v; } });
  };
  if(c.storage && c.storage.from){
    const os = c.storage.from.bind(c.storage);
    c.storage.from = function(bk){
      const b = os(bk);
      return new Proxy(b, { get(tg, k){
        if(['upload', 'update', 'remove', 'move', 'copy'].indexOf(k) >= 0 && !(ST.me && (ST.legacy || ST.me.role === 'admin' || BUCKET_W.some(f => level(f) >= 2))))
          return async () => ({ data:null, error:{ message:'Akses hanya lihat untuk dokumen. Minta admin memberi level "View & edit".', code:'AG_READONLY' } });
        const v = tg[k]; return typeof v === 'function' ? v.bind(tg) : v; } });
    };
  }
}

/* ---------- menu, level lihat-saja, chip akun ---------- */
function toast(t){ let e = $('agToast'); if(!e){ e = D.createElement('div'); e.id = 'agToast'; e.setAttribute('role', 'status'); D.body.appendChild(e); } e.textContent = t; e.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => { e.style.display = 'none'; }, 3800); }
function navAcct(){
  const foot = $('sideNavFoot'); if(!foot || !ST.me) return; let b = $('agNavAcct');
  if(!b){ b = D.createElement('button'); b.type = 'button'; b.id = 'agNavAcct'; b.className = 'sn-item'; b.setAttribute('aria-haspopup', 'true'); b.addEventListener('click', e => { e.stopPropagation(); menu(b); }); }
  const nm = ST.me.full_name || ST.me.email || '?'; const pend = ST.me.role === 'admin' && !ST.legacy && ST.users.some(u => u.status === 'pending');
  b.innerHTML = `<span class="av">${esc(String(nm).trim().charAt(0).toUpperCase())}</span><span class="nm">${esc(nm)}</span>${pend ? '<span class="dot" title="Ada akun menunggu persetujuan"></span>' : ''}`;
  if(b.parentNode !== foot || foot.firstChild !== b) foot.insertBefore(b, foot.firstChild);
}
function filterNav(){
  navAcct();
  if(!ST.me || ST.legacy) return;
  const list = $('sideNavList'), foot = $('sideNavFoot'); if(!list) return;
  list.querySelectorAll('.sn-subitem').forEach(b => { const m = /navGo\('([^']+)'\)/.exec(b.getAttribute('onclick') || ''); if(m && level(m[1]) < 1) b.remove(); });
  [list, foot].forEach(box => { if(!box) return; box.querySelectorAll('.sn-item').forEach(b => {
    if(b.id === 'agNavAcct') return;
    const m = /toggleNavGroup\('([^']+)'\)/.exec(b.getAttribute('onclick') || ''); if(!m) return;
    const g = (typeof NAV_GROUPS !== 'undefined' ? NAV_GROUPS : []).find(x => x.key === m[1]);
    if(g && g.panels.every(p => level(p) < 1)){ const sub = b.nextElementSibling; if(sub && sub.classList.contains('sn-sub')) sub.remove(); b.remove(); } }); });
  const sp = $('snStatus'); if(sp) sp.style.display = level('settings') >= 1 ? '' : 'none';
}
function mark(name){
  D.querySelectorAll('.ag-ro').forEach(e => e.classList.remove('ag-ro')); D.querySelectorAll('.ag-ribbon').forEach(e => e.remove());
  if(!ST.me || ST.legacy) return; const el = $('panel-' + name); if(!el) return;
  if(level(name) === 1){ el.classList.add('ag-ro'); const r = D.createElement('div'); r.className = 'ag-ribbon'; r.setAttribute('role', 'note'); r.textContent = 'Mode lihat saja: Anda dapat melihat menu ini, tetapi tidak dapat menambah atau mengubah data. Hubungi admin untuk akses ubah.'; el.insertBefore(r, el.firstChild); }
}
function chip(on){
  let b = $('agChip');
  if(!b){ b = D.createElement('button'); b.id = 'agChip'; b.type = 'button'; b.setAttribute('aria-haspopup', 'true'); b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-label', 'Akun'); b.addEventListener('click', e => { e.stopPropagation(); menu(); }); D.body.appendChild(b); }
  b.classList.toggle('on', !!on && !!ST.me); if(!on){ const m = $('agMenu'); if(m) m.classList.remove('on'); }
}
function chipUpdate(){
  const b = $('agChip'); if(!b || !ST.me) return; const nm = ST.me.full_name || ST.me.email || '?';
  const pend = ST.me.role === 'admin' && !ST.legacy && ST.users.some(u => u.status === 'pending');
  b.innerHTML = `<span class="av">${esc(String(nm).trim().charAt(0).toUpperCase())}</span><span class="nm">${esc(nm)}</span>${pend ? '<span class="dot" title="Ada akun menunggu persetujuan"></span>' : ''}`; b.classList.add('on');
  navAcct();
}
function menu(anchor){
  let m = $('agMenu'); if(!m){ m = D.createElement('div'); m.id = 'agMenu'; m.setAttribute('role', 'menu'); D.body.appendChild(m);
    D.addEventListener('click', e => { if(!m.contains(e.target) && e.target !== $('agChip') && !e.target.closest('#agNavAcct')) m.classList.remove('on'); });
    m.addEventListener('click', e => { const a = e.target.closest('[data-m]'); if(!a) return; m.classList.remove('on'); if(a.dataset.m === 'logout') logout(); if(a.dataset.m === 'admin'){ window.showPanel('settings'); setTimeout(() => { const c = $('agAdminCard'); if(c) c.scrollIntoView({ behavior:'smooth', block:'start' }); }, 400); } if(a.dataset.m === 'refresh'){ recheck(); } }); }
  if(m.classList.contains('on')){ m.classList.remove('on'); $('agChip').setAttribute('aria-expanded', 'false'); return; }
  const me = ST.me; if(!me) return; const pend = ST.users.filter(u => u.status === 'pending').length;
  const fl = me.role === 'admin' ? 'Semua menu (admin)' : (facGroups().reduce((n, g) => n + g.items.filter(i => level(i.key) >= 1).length, 0) + ' menu aktif');
  m.innerHTML = `<div><b>${esc(me.full_name || me.email)}</b><div style="color:#57636f;word-break:break-all">${esc(me.email)}</div></div>
    <div style="margin-top:6px"><span class="pill">${me.role === 'admin' ? 'Admin' : 'User'}</span><span class="pill">${ST.legacy ? 'Manajemen user belum aktif' : esc(fl)}</span></div>
    ${me.role === 'admin' ? `<button type="button" data-m="admin" role="menuitem">Users &amp; Access${pend ? ' (' + pend + ' menunggu)' : ''}</button>` : '<button type="button" data-m="refresh" role="menuitem">Refresh access</button>'}<button type="button" data-m="logout" role="menuitem">Logout</button>`;
  if(anchor && anchor.getBoundingClientRect && window.matchMedia && matchMedia('(min-width:1025px)').matches){ const r = anchor.getBoundingClientRect(); m.style.left = (r.right + 8) + 'px'; m.style.bottom = Math.max(8, innerHeight - r.bottom) + 'px'; m.style.top = 'auto'; m.style.right = 'auto'; }
  else if(anchor && anchor.getBoundingClientRect){ m.style.left = '12px'; m.style.right = 'auto'; m.style.top = 'auto'; m.style.bottom = '72px'; }
  else { m.style.left = ''; m.style.bottom = ''; m.style.top = ''; m.style.right = ''; }
  m.classList.add('on'); $('agChip').setAttribute('aria-expanded', 'true');
}

/* ---------- panel admin (Settings) ---------- */
async function loadUsers(){
  const c = C(); if(!c || !ST.me || ST.me.role !== 'admin') return;
  const r = await c.from('app_profile').select('*').order('created_at', { ascending:true });
  if(r.error){ ST.usersMsg = { k:'err', t:tr(r.error) }; ST.users = []; } else { ST.users = r.data || []; ST.usersMsg = null; }
  chipUpdate(); renderAdmin();
}
const PRESETS = { none:'None', view:'View only', edit:'View & edit' };
function presetFac(l){ const o = {}; allPanels().forEach(k => { o[k] = l; }); return o; }
function adminHtml(){
  if(ST.legacy) return `<div class="card-head"><h2>Users &amp; Access</h2><span class="status-pill warn">Belum aktif</span></div>
    <p class="hint">Database ini belum punya tabel akun (<code>app_profile</code>). Selama belum dipasang, <b>semua akun yang berhasil login diperlakukan sebagai admin</b> (seperti sebelumnya). Untuk mengaktifkan peran admin dan fasilitas per user: (1) aktifkan "Confirm email" di Supabase Authentication, (2) jalankan SQL di bawah di SQL Editor, (3) daftar ulang akun admin (<code>ifauzi@outlook.com</code>) bila belum ada, lalu muat ulang aplikasi.</p>
    <details><summary>SQL migrasi (langkah 41)</summary><pre id="agSql1">${esc(SQL_MIGRATION)}</pre><button type="button" class="ghost" data-ag="copy" data-t="agSql1">Copy SQL</button></details>
    <details style="margin-top:8px"><summary>SQL pembatasan database per fasilitas (opsional, jalankan setelah admin bisa login)</summary><pre id="agSql2">${esc(SQL_RLS)}</pre><button type="button" class="ghost" data-ag="copy" data-t="agSql2">Copy SQL</button></details>`;
  const pend = ST.users.filter(u => u.status === 'pending').length;
  const pill = (k, t) => `<span class="status-pill ${k}">${esc(t)}</span>`;
  const groups = facGroups();
  const row = u => {
    const self = ST.me && u.user_id === ST.me.user_id; const open = ST.openRows.has(u.user_id) || u.status === 'pending';
    const sel = (id, v, opts, dis) => `<select data-ag-f="${id}" data-uid="${esc(u.user_id)}" ${dis ? 'disabled' : ''}>${opts.map(o => `<option value="${o[0]}"${o[0] === v ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
    const lv = [['none', 'None'], ['view', 'View only'], ['edit', 'View & edit']];
    const fac = (u.facilities || {});
    return `<div class="ag-u" data-uid="${esc(u.user_id)}"><div class="ag-uh"><div><b>${esc(u.full_name || '(tanpa nama)')}</b><small>${esc(u.email)}</small></div>
      <div>${pill(u.role === 'admin' ? 'ok' : 'muted', u.role === 'admin' ? 'Admin' : 'User')} ${pill(u.status === 'active' ? 'ok' : (u.status === 'pending' ? 'warn' : 'err'), u.status === 'active' ? 'Aktif' : (u.status === 'pending' ? 'Menunggu' : 'Nonaktif'))}</div></div>
      ${ST.rowMsg[u.user_id] ? `<div class="msg show ${ST.rowMsg[u.user_id].k}" style="margin-top:8px">${esc(ST.rowMsg[u.user_id].t)}</div>` : ''}
      ${u.status === 'pending' && !self ? `<div class="ag-act"><button type="button" class="primary" data-ag="approve" data-uid="${esc(u.user_id)}" data-lv="view">Approve — View only</button><button type="button" class="ghost" data-ag="approve" data-uid="${esc(u.user_id)}" data-lv="edit">Approve — Full edit</button></div>` : ''}
      <details data-uid="${esc(u.user_id)}" ${open ? 'open' : ''}><summary style="margin-top:8px;cursor:pointer">Atur akses</summary>
        <div class="ag-fac" style="margin-top:8px"><label>Role ${sel('role', u.role, [['user', 'User'], ['admin', 'Admin']], self)}</label><label>Status ${sel('status', u.status, [['pending', 'Menunggu'], ['active', 'Aktif'], ['disabled', 'Nonaktif']], self)}</label></div>
        ${self ? '<p class="hint">Ini akun Anda; role dan status tidak dapat diubah dari sini.</p>' : ''}
        ${u.role === 'admin' ? '<p class="hint">Admin otomatis memiliki akses ubah ke semua menu dan Settings.</p>' : ''}
        <div class="ag-act"><span class="hint" style="align-self:center">Atur semua menu:</span>${Object.keys(PRESETS).map(k => `<button type="button" class="ghost" data-ag="preset" data-uid="${esc(u.user_id)}" data-lv="${k}">${PRESETS[k]}</button>`).join('')}</div>
        ${groups.map(g => `<div class="ag-g">${esc(g.label)}</div><div class="ag-fac">${g.items.map(i => `<label>${esc(i.label)} ${sel('fac:' + i.key, fac[i.key] || 'none', lv, false)}</label>`).join('')}</div>`).join('')}
        <div class="ag-act"><button type="button" class="primary" data-ag="save" data-uid="${esc(u.user_id)}">Simpan akses</button></div></details></div>`;
  };
  return `<div class="card-head"><h2>Users &amp; Access</h2>${pill(pend ? 'warn' : 'ok', pend ? pend + ' menunggu persetujuan' : 'Admin')}</div>
    <p class="hint">Hanya admin yang melihat kartu ini. Akun baru berstatus <b>Menunggu</b> sampai Anda mengaktifkannya. Akun tidak pernah dihapus dari sini: gunakan status <b>Nonaktif</b>. Level: <b>None</b> menyembunyikan menu, <b>View only</b> hanya melihat, <b>View &amp; edit</b> boleh menambah/mengubah.</p>
    ${ST.usersMsg ? `<div class="msg show ${ST.usersMsg.k}" style="margin-bottom:8px">${esc(ST.usersMsg.t)}</div>` : ''}
    <div class="row-actions"><button type="button" class="ghost" data-ag="refresh">Refresh</button></div>
    ${ST.users.length ? ST.users.map(row).join('') : '<p class="hint">Belum ada akun.</p>'}
    <details style="margin-top:12px"><summary>SQL pembatasan database per fasilitas (opsional)</summary><p class="hint">Menegakkan aturan di database: penulisan tabel dibatasi per menu, akun pending/nonaktif ditolak. Jalankan setelah backup dan setelah Anda memastikan admin dapat login.</p><pre id="agSql2">${esc(SQL_RLS)}</pre><button type="button" class="ghost" data-ag="copy" data-t="agSql2">Copy SQL</button></details>
    <details style="margin-top:8px"><summary>Rollback RLS (pulihkan akses anon)</summary><p class="hint">Gunakan bila pembatasan database terlalu ketat atau muncul <em>“new row violates row-level security policy”</em> dan Anda ingin kembali ke akses lama. Tidak menghapus data dan tidak menghapus akun.</p><pre id="agSql3">${esc(SQL_RLS_RB)}</pre><button type="button" class="ghost" data-ag="copy" data-t="agSql3">Copy SQL</button></details>`;
}
function renderAdmin(){ const c = $('agAdminCard'); if(c) c.innerHTML = adminHtml(); }
function mountAdmin(){
  const root = $('ac6SettingsRoot'); if(!root || !ST.me) return;
  let c = $('agAdminCard');
  if(ST.me.role === 'admin' || ST.legacy){
    if(!c){ c = D.createElement('div'); c.id = 'agAdminCard'; c.className = 'card'; c.style.marginBottom = '12px'; c.addEventListener('click', onAdminClick); root.insertBefore(c, root.firstChild); }
    c.innerHTML = adminHtml(); if(!ST.legacy) loadUsers();
  }
  const old = Array.from(root.querySelectorAll('.card')).find(x => { const h = x.querySelector('h2'); return h && /^Login \(opsional\)$/.test(h.textContent.trim()); });
  if(old && ST.me){ old.innerHTML = `<div class="card-head"><h2>Account</h2><span class="status-pill ok">${esc(ST.me.email)}</span></div><p class="hint">Masuk sebagai <b>${esc(ST.me.full_name || ST.me.email)}</b> · ${ST.me.role === 'admin' ? 'Admin' : 'User'}. Sesi dikelola Supabase Auth; password tidak disimpan aplikasi.</p><button type="button" class="ghost" onclick="AC6.access.logout()">Logout</button>`; }
}
function collect(uid){
  const q = k => D.querySelector(`#agAdminCard [data-ag-f="${k}"][data-uid="${uid}"]`);
  const fac = {}; allPanels().forEach(p => { const e = q('fac:' + p); fac[p] = e ? e.value : 'none'; });
  return { role:q('role') ? q('role').value : undefined, status:q('status') ? q('status').value : undefined, facilities:fac };
}
async function saveUser(uid, patch, okMsg){
  const c = C(); const u = ST.users.find(x => x.user_id === uid); if(!c || !u) return;
  if(ST.me && uid === ST.me.user_id){ ST.rowMsg[uid] = { k:'err', t:'Akun Anda sendiri tidak dapat diubah dari sini.' }; return renderAdmin(); }
  const body = {}; ['role', 'status', 'facilities'].forEach(k => { if(patch[k] !== undefined) body[k] = patch[k]; });
  if(body.role === 'admin'){ /* admin tidak memerlukan rincian fasilitas */ }
  const r = await c.from('app_profile').update(body).eq('user_id', uid).select().maybeSingle();
  if(r.error) ST.rowMsg[uid] = { k:'err', t:tr(r.error) };
  else if(!r.data) ST.rowMsg[uid] = { k:'err', t:'Perubahan tidak tersimpan (tidak ada izin atau akun tidak ditemukan).' };
  else { Object.assign(u, r.data); ST.rowMsg[uid] = { k:'ok', t:okMsg || 'Tersimpan.' }; }
  ST.openRows.add(uid); chipUpdate(); renderAdmin();
}
function onAdminClick(ev){
  const b = ev.target.closest('[data-ag]'); if(!b) return; const a = b.dataset.ag, uid = b.dataset.uid;
  if(a === 'refresh'){ ST.rowMsg = {}; loadUsers(); }
  else if(a === 'copy'){ const t = $(b.dataset.t); if(t) { const txt = t.textContent; if(navigator.clipboard) navigator.clipboard.writeText(txt).then(() => { b.textContent = 'Tersalin'; }).catch(() => { b.textContent = 'Salin manual'; }); } }
  else if(a === 'preset'){ D.querySelectorAll(`#agAdminCard select[data-uid="${uid}"][data-ag-f^="fac:"]`).forEach(s => { s.value = b.dataset.lv; }); ST.openRows.add(uid); }
  else if(a === 'approve'){ saveUser(uid, { status:'active', facilities:presetFac(b.dataset.lv) }, 'Akun diaktifkan (' + PRESETS[b.dataset.lv] + ').'); }
  else if(a === 'save'){ const p = collect(uid); saveUser(uid, p, 'Akses tersimpan.'); }
}
D.addEventListener('toggle', e => { const d = e.target; if(d && d.tagName === 'DETAILS' && d.dataset.uid){ if(d.open) ST.openRows.add(d.dataset.uid); else ST.openRows.delete(d.dataset.uid); } }, true);

/* ---------- pemasangan hook ---------- */
function wrap(name, make){ const o = window[name]; if(typeof o !== 'function' || o.__ag) return; const w = make(o); w.__ag = 1; window[name] = w; }
function hooks(){
  wrap('showPanel', o => function(name){
    if(D.documentElement.classList.contains('ag-lock') && ST.mode !== 'ok') return;
    let n = name;
    if(ST.me && !ST.legacy && level(n) < 1){ const alt = firstAllowed(); toast('Menu "' + ((typeof PANEL_LABELS !== 'undefined' && PANEL_LABELS[n]) || n) + '" tidak tersedia untuk akun Anda. Hubungi admin.'); if(!alt) return; n = alt; }
    const r = o.call(this, n); try{ mark(n); }catch(e){} return r;
  });
  wrap('clearConnection', o => function(){ const r = o.apply(this, arguments); ST.me = null; ST.user = null; ST.canBack = false; try{ lock('config'); }catch(e){} return r; });
  wrap('renderSideNav', o => function(){ const r = o.apply(this, arguments); try{ filterNav(); }catch(e){} return r; });
  wrap('initClient', o => function(){ const r = o.apply(this, arguments); try{ attach(); if(ST.me) guard(C()); }catch(e){} if(ST.mode === 'config' || ST.mode === 'boot') setTimeout(resolve, 0); return r; });
  if(window.AC6 && AC6.settings && AC6.settings.render && !AC6.settings.render.__ag){
    const o = AC6.settings.render; const w = function(){ const r = o.apply(this, arguments); try{ mountAdmin(); }catch(e){ console.error('[ag]', e); } return r; }; w.__ag = 1; AC6.settings.render = w; }
}
D.addEventListener('submit', e => { const p = e.target && e.target.closest && e.target.closest('.ag-ro'); if(p){ e.preventDefault(); e.stopImmediatePropagation(); toast('Mode lihat saja: perubahan tidak diizinkan untuk akun Anda.'); } }, true);
D.addEventListener('visibilitychange', () => { if(D.visibilityState === 'visible') recheck(); });

function onAuth(evt){
  setTimeout(() => {
    if(evt === 'SIGNED_OUT'){ clearProf(); if(ST.me || ST.user){ ST.me = null; ST.user = null; if(!MOCK){ location.reload(); return; } } lock('login'); }
    else if(evt === 'PASSWORD_RECOVERY'){ ST.recovery = true; lock('recovery'); }
    else if(evt === 'SIGNED_IN' && !ST.me && !ST.resolving && ST.mode !== 'boot' && ST.mode !== 'recovery' && !ST.busy){ resolve(); }
  }, 0);
}
function attach(){
  const c = C(); if(!c || c === ST.client) return;
  if(ST.sub) try{ ST.sub.unsubscribe(); }catch(e){}
  if(ST.client && ST.client !== c && ST.client.auth && ST.client.auth.stopAutoRefresh) try{ ST.client.auth.stopAutoRefresh(); }catch(e){}
  ST.client = c;
  const r = c.auth.onAuthStateChange((evt) => onAuth(evt)); ST.sub = r && r.data && r.data.subscription;
}

async function boot(){
  css(); hooks(); D.documentElement.classList.add('ag-lock'); window.__agReady = true; render(false);
  if(/(^|[#&?])type=recovery/.test(location.hash + location.search)) ST.recovery = true;
  if(!MOCK){
    let n = 0; while(!window.supabase && n++ < 40) await new Promise(r => setTimeout(r, 150));
    if(!window.supabase) return lock('error', { k:'err', t:'Pustaka Supabase belum termuat (offline?). Periksa koneksi lalu coba lagi.' });
  }
  attach(); await resolve();
  const recheckIfBack = () => { if(ST.me || ST.mode === 'pending') recheck(); };
  window.addEventListener('online', () => { if(ST.offline){ ST.offline = false; ST.lastCheck = 0; resolve(); } else recheckIfBack(); });
}
window.AG = { state:ST, level, canWrite, resolve, logout, tr, firstAllowed };
if(window.AC6) AC6.access = { logout, level, canWrite, state:ST };
boot().catch(e => { console.error('[ag] boot', e); try{ lock('error', { k:'err', t:'Gagal memulai pemeriksaan akun: ' + (e && e.message || e) }); }catch(x){ D.documentElement.classList.remove('ag-lock'); } });
})();
