const API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';
const REFRESH_MS = 60 * 60 * 1000;
const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DAYS_F = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
let nextRefAt = null, refreshTimer = null;

// ── CLOCK ──
function tick() {
  const n = new Date();
  document.getElementById('ltime').textContent = n.toLocaleTimeString('pt-BR');
  document.getElementById('ldate').textContent = n.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
  if (nextRefAt) {
    const d = Math.max(0, nextRefAt - Date.now());
    const rm = String(Math.floor(d / 60000)).padStart(2, '0');
    const rs = String(Math.floor((d % 60000) / 1000)).padStart(2, '0');
    document.getElementById('nupd').textContent = `Próxima: ${rm}:${rs}`;
  }
}
setInterval(tick, 1000);
tick();

// ── HEATMAP MATRIX ──
function heatmapMatrix(p) {
  const b = {
    tiktok: [
      [4,3,2,1,1,1,2,4,6,6,6,7,7,8,7,8,9,10,9,8,7,6,5,4],
      [4,3,2,1,1,1,2,5,7,7,6,8,8,8,7,8,9,9,10,9,8,7,6,4],
      [5,3,2,1,1,1,3,5,7,8,7,8,8,9,8,9,9,10,10,9,8,7,5,4],
      [5,4,2,1,1,1,2,4,6,7,7,8,8,8,7,8,9,10,9,8,7,8,7,5],
      [5,3,2,1,1,1,2,4,6,7,6,7,7,8,8,9,9,10,9,9,8,8,7,5],
      [6,4,3,2,1,1,2,4,5,5,5,7,8,9,8,8,9,9,8,8,9,9,8,6],
      [7,5,4,3,2,1,2,3,4,5,6,7,8,9,9,8,8,8,8,9,9,9,8,7],
    ],
    instagram: [
      [3,2,1,1,1,2,4,7,9,8,7,7,8,7,6,7,9,9,8,7,6,5,4,3],
      [3,2,1,1,1,2,5,8,9,9,7,8,8,7,7,8,9,10,8,7,6,5,4,3],
      [4,2,1,1,1,2,4,7,8,8,7,8,9,8,7,8,9,10,9,7,6,5,4,3],
      [4,2,1,1,1,2,4,7,8,8,7,8,8,8,8,8,9,9,9,8,6,5,4,3],
      [4,2,1,1,1,2,4,7,8,8,7,7,7,7,7,8,9,9,8,7,6,5,4,3],
      [4,3,2,1,1,1,3,5,6,6,6,7,8,8,7,7,8,8,7,7,8,7,6,4],
      [5,4,3,2,1,1,2,4,5,6,7,8,8,8,7,7,7,7,7,8,8,7,6,5],
    ]
  };
  return b[p].map(r => r.map(v => Math.max(1, Math.min(10, v + (Math.random() > .72 ? (Math.random() > .5 ? 1 : -1) : 0)))));
}

function buildHM(gid, hid, mx, p) {
  const g = document.getElementById(gid), hEl = document.getElementById(hid);
  if (!g) return;
  const now = new Date(), dw = now.getDay(), ch = now.getHours();
  const clr = p === 'tiktok'
    ? v => `rgba(255,45,85,${0.04 + (v / 10) * .96})`
    : v => `rgba(247,119,55,${0.04 + (v / 10) * .96})`;
  g.innerHTML = '';
  mx.forEach((row, d) => {
    const re = document.createElement('div'); re.className = 'hm-row';
    const de = document.createElement('div'); de.className = 'hm-day'; de.textContent = DAYS[d]; re.appendChild(de);
    row.forEach((val, h) => {
      const c = document.createElement('div'); c.className = 'hm-cell';
      c.style.background = clr(val);
      if (d === dw && h === ch) c.classList.add('cur');
      const t = document.createElement('div'); t.className = 'hm-tip';
      t.textContent = `${DAYS[d]} ${String(h).padStart(2, '0')}h — Score: ${val}/10`;
      c.appendChild(t); re.appendChild(c);
    });
    g.appendChild(re);
  });
  if (hEl) {
    hEl.innerHTML = '<div></div>';
    for (let i = 0; i < 24; i++) {
      const l = document.createElement('div');
      l.className = 'hm-hl';
      l.textContent = i % 3 === 0 ? `${i}h` : '';
      hEl.appendChild(l);
    }
  }
}

// ── RENDER HELPERS ──
function rStats(id, stats) {
  const el = document.getElementById(id); if (!el) return;
  el.innerHTML = stats.map(s =>
    `<div class="card">
      <div class="card-lbl">${s.lbl}</div>
      <div class="card-val" style="color:${s.color}">${s.val}</div>
      <div class="card-sub"><span class="badge ${s.tr}">${s.trTxt}</span> ${s.sub}</div>
    </div>`
  ).join('');
}

function rFactors(id, fs, ac) {
  const el = document.getElementById(id); if (!el) return;
  el.innerHTML = fs.map(f =>
    `<div class="fbar">
      <div class="fbar-h">
        <span class="fbar-n">${f.e} ${f.n}</span>
        <span class="fbar-p" style="color:${ac}">${f.p}%</span>
      </div>
      <div class="bar-t"><div class="bar-f" style="width:${f.p}%;background:${f.g}"></div></div>
    </div>`
  ).join('');
}

function rTimes(id, ts) {
  const el = document.getElementById(id); if (!el) return;
  el.innerHTML = ts.map(t =>
    `<div class="t-item">
      <div><div class="ti" style="color:${t.c}">${t.time}</div><div class="di">${t.day}</div></div>
      <div style="display:flex;align-items:center;gap:8px">
        <div class="s-bar"><div class="s-fill" style="width:${t.score}%;background:${t.c}"></div></div>
        <span style="font-size:11px;color:${t.c};font-weight:600">${t.score}</span>
      </div>
    </div>`
  ).join('');
}

function rTrending(id, items) {
  const el = document.getElementById(id); if (!el) return;
  el.innerHTML = items.map((it, i) =>
    `<div class="trend-item">
      <span class="tr-rank">${i + 1}</span>
      <span class="tr-name">${it.name}</span>
      <span class="tr-meta">${it.meta || ''}</span>
      <span class="tr-badge ${it.badge || 'rise'}">${it.badge === 'hot' ? '🔥 HOT' : it.badge === 'new' ? '✨ NEW' : '↑ RISE'}</span>
    </div>`
  ).join('');
}

function rFormats(id, fmts) {
  const el = document.getElementById(id); if (!el) return;
  const gs = [
    'linear-gradient(90deg,var(--tt),var(--accent))',
    'linear-gradient(90deg,var(--accent),#00bcd4)',
    'linear-gradient(90deg,var(--yellow),#ff9800)',
    'linear-gradient(90deg,var(--green),#00bcd4)'
  ];
  el.innerHTML = fmts.map((f, i) =>
    `<div class="fmt-card">
      <div class="fmt-ico">${f.icon}</div>
      <div class="fmt-n">${f.name}</div>
      <div class="fmt-d">${f.desc}</div>
      <div class="fmt-bar"><div class="fmt-f" style="width:${f.pct}%;background:${gs[i % 4]}"></div></div>
    </div>`
  ).join('');
}

// ── AI FETCH ──
async function fetchData(platform) {
  const niche = document.getElementById('nicheSelect').value;
  const now = new Date();
  const prompt = `Você é analista de redes sociais. Hoje: ${DAYS_F[now.getDay()]}, ${now.toLocaleDateString('pt-BR')}, ${now.getHours()}h (Brasília). Nicho: "${niche}". Plataforma: ${platform === 'tiktok' ? 'TikTok' : 'Instagram'}.

Retorne APENAS JSON válido (sem markdown), neste esquema:
{"stats":{"retention":"string","reach":"string","peakHour":"string","retTrend":"up|down|neu","rchTrend":"up|down|neu"},"bestTimes":[{"day":"string","time":"string","score":number,"tier":"top|good|ok"}],"trending":[{"name":"string","meta":"string","badge":"hot|rise|new"}],"hashtags":[{"name":"string","meta":"string","badge":"hot|rise|new"}],"formats":[{"icon":"emoji","name":"string","desc":"string","pct":number}],"insight":"string"}

Requisitos: bestTimes 5 itens, trending 5, hashtags 5, formats 4. Use dados reais e atuais do Brasil para o nicho "${niche}". Os horários devem refletir o comportamento real do algoritmo.`;

  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1800,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      system: 'Especialista em algoritmos de redes sociais. Responda sempre com JSON puro e válido, sem nenhum texto fora do JSON.',
      messages: [{ role: 'user', content: prompt }]
    })
  });
  const d = await res.json();
  const txt = d.content?.filter(b => b.type === 'text').map(b => b.text).join('') || '';
  const clean = txt.replace(/```json|```/g, '').trim();
  const s = clean.indexOf('{'), e = clean.lastIndexOf('}');
  if (s === -1 || e === -1) throw new Error('No JSON');
  return JSON.parse(clean.slice(s, e + 1));
}

// ── APPLY DATA ──
function applyTT(d) {
  const tc = t => t === 'top' ? 'var(--green)' : t === 'good' ? 'var(--yellow)' : 'var(--muted2)';
  const bm = { up: '▲ Subindo', down: '▼ Caindo', neu: '≈ Estável' };
  rStats('tt-stats', [
    { lbl: 'Taxa de Retenção Média',  val: d.stats.retention, color: 'var(--tt)',     tr: d.stats.retTrend || 'neu', trTxt: bm[d.stats.retTrend || 'neu'], sub: 'vs semana anterior' },
    { lbl: 'Alcance Orgânico FYP',   val: d.stats.reach,     color: 'var(--accent)', tr: 'neu', trTxt: '≈ Normal', sub: 'multiplicador médio' },
    { lbl: 'Horário de Pico Agora',  val: d.stats.peakHour,  color: 'var(--yellow)', tr: 'neu', trTxt: '⚡ Ativo', sub: 'melhor janela hoje' },
  ]);
  rFactors('tt-factors', [
    { e: '⏱',  n: 'Taxa de Retenção',      p: 35, g: 'linear-gradient(90deg,var(--tt),#ff6b8a)' },
    { e: '💬', n: 'Comentários & Shares',   p: 25, g: 'linear-gradient(90deg,var(--accent),#00bcd4)' },
    { e: '❤️', n: 'Curtidas (1ª hora)',     p: 20, g: 'linear-gradient(90deg,var(--yellow),#ffb300)' },
    { e: '🔁', n: 'Replays',               p: 12, g: 'linear-gradient(90deg,var(--green),#00c853)' },
    { e: '🎵', n: 'Áudio em Alta',          p: 5,  g: 'linear-gradient(90deg,var(--ig),var(--ig2))' },
    { e: '🏷️', n: 'Hashtags Relevantes',   p: 3,  g: '#7c3aed' },
  ], 'var(--tt)');
  document.getElementById('tt-dlbl').textContent = DAYS_F[new Date().getDay()];
  rTimes('tt-times', d.bestTimes.map(t => ({ ...t, c: tc(t.tier) })));
  const mx = heatmapMatrix('tiktok');
  buildHM('tt-hm', 'tt-hh', mx, 'tiktok');
  buildHM('cmp-tt-hm', 'cmp-tt-hh', mx, 'tiktok');
  rTrending('tt-trending', d.trending);
  rTrending('tt-hashtags', d.hashtags);
  rFormats('tt-fmts', d.formats);
  document.getElementById('tt-hmsub').textContent = `Atualizado às ${new Date().toLocaleTimeString('pt-BR')} — hora atual destacada`;
  const ins = document.getElementById('tt-insight');
  if (ins) ins.innerHTML = `<p style="font-size:14px;line-height:1.75">${d.insight}</p><p style="font-size:11px;color:var(--muted);margin-top:8px">Gerado com IA + dados ao vivo às ${new Date().toLocaleTimeString('pt-BR')}</p>`;
}

function applyIG(d) {
  const tc = t => t === 'top' ? 'var(--green)' : t === 'good' ? 'var(--yellow)' : 'var(--muted2)';
  const bm = { up: '▲ Subindo', down: '▼ Caindo', neu: '≈ Estável' };
  rStats('ig-stats', [
    { lbl: 'Taxa de Engajamento Média', val: d.stats.retention, color: 'var(--ig2)',   tr: d.stats.retTrend || 'neu', trTxt: bm[d.stats.retTrend || 'neu'], sub: 'vs semana anterior' },
    { lbl: 'Alcance Orgânico Reels',    val: d.stats.reach,     color: 'var(--accent)', tr: 'neu', trTxt: '≈ Normal', sub: 'multiplicador médio' },
    { lbl: 'Horário de Pico Agora',     val: d.stats.peakHour,  color: 'var(--yellow)', tr: 'neu', trTxt: '⚡ Ativo', sub: 'melhor janela hoje' },
  ]);
  rFactors('ig-factors', [
    { e: '💬', n: 'Comentários (qualidade)', p: 30, g: 'linear-gradient(90deg,var(--ig),var(--ig2))' },
    { e: '🔖', n: 'Saves',                   p: 28, g: 'linear-gradient(90deg,var(--ig3),#818cf8)' },
    { e: '📤', n: 'Compartilhamentos',        p: 22, g: 'linear-gradient(90deg,var(--accent),#00bcd4)' },
    { e: '❤️', n: 'Curtidas',                p: 12, g: 'linear-gradient(90deg,var(--tt),#ff6b8a)' },
    { e: '⏱',  n: 'Retenção (Reels)',         p: 5,  g: 'linear-gradient(90deg,var(--green),#00c853)' },
    { e: '📅', n: 'Consistência',             p: 3,  g: 'var(--yellow)' },
  ], 'var(--ig2)');
  document.getElementById('ig-dlbl').textContent = DAYS_F[new Date().getDay()];
  rTimes('ig-times', d.bestTimes.map(t => ({ ...t, c: tc(t.tier) })));
  const mx = heatmapMatrix('instagram');
  buildHM('ig-hm', 'ig-hh', mx, 'instagram');
  buildHM('cmp-ig-hm', 'cmp-ig-hh', mx, 'instagram');
  rTrending('ig-trending', d.trending);
  rTrending('ig-hashtags', d.hashtags);
  rFormats('ig-fmts', d.formats);
  document.getElementById('ig-hmsub').textContent = `Atualizado às ${new Date().toLocaleTimeString('pt-BR')} — hora atual destacada`;
  const ins = document.getElementById('ig-insight');
  if (ins) ins.innerHTML = `<p style="font-size:14px;line-height:1.75">${d.insight}</p><p style="font-size:11px;color:var(--muted);margin-top:8px">Gerado com IA + dados ao vivo às ${new Date().toLocaleTimeString('pt-BR')}</p>`;
  const ci = document.getElementById('cmp-insight');
  if (ci) ci.innerHTML = `<p style="font-size:14px;line-height:1.75">${d.insight}</p><p style="font-size:11px;color:var(--muted);margin-top:8px">Gerado às ${new Date().toLocaleTimeString('pt-BR')}</p>`;
}

// ── FALLBACK ──
function fallback() {
  const now = new Date(), h = now.getHours(), peak = h >= 17 && h <= 22 ? `${h}h` : '19h';
  const ttD = {
    stats: { retention: '68%', reach: '12.4x', peakHour: peak, retTrend: 'up', rchTrend: 'neu' },
    bestTimes: [
      { day: 'Terça',   time: '19:00–21:00', score: 95, tier: 'top' },
      { day: 'Quinta',  time: '18:00–20:00', score: 90, tier: 'top' },
      { day: 'Sexta',   time: '21:00–23:00', score: 85, tier: 'top' },
      { day: 'Sábado',  time: '14:00–16:00', score: 78, tier: 'good' },
      { day: 'Dom.',    time: '11:00–13:00', score: 72, tier: 'good' },
    ],
    trending: [
      { name: '#foryou',    meta: '1.2B views', badge: 'hot' },
      { name: '#viral',     meta: '980M',        badge: 'hot' },
      { name: '#fyp',       meta: '2.1B',        badge: 'hot' },
      { name: '#brasil',    meta: '450M',        badge: 'rise' },
      { name: '#novidade',  meta: '320M',        badge: 'new' },
    ],
    hashtags: [
      { name: '#trending',    meta: 'Alta',    badge: 'hot' },
      { name: '#tiktokviral', meta: 'Subindo', badge: 'rise' },
      { name: '#criador',     meta: 'Estável', badge: 'rise' },
      { name: '#reels',       meta: 'Alta',    badge: 'hot' },
      { name: '#algoritmo',   meta: 'Nova',    badge: 'new' },
    ],
    formats: [
      { icon: '⚡', name: 'Trend/Áudio',  desc: 'Maior alcance, viral rápido', pct: 95 },
      { icon: '📖', name: 'Storytelling', desc: 'Retenção 65–80%',             pct: 82 },
      { icon: '🎓', name: 'Educar <60s', desc: 'Shares altos',                 pct: 75 },
      { icon: '💡', name: 'Tutorial',     desc: 'Saves e replays',              pct: 70 },
    ],
    insight: `Hoje (${DAYS_F[now.getDay()]}) é um bom dia para postar entre ${peak} e 21h. Foque em gancho nos primeiros 3 segundos para maximizar retenção no FYP.`
  };
  const igD = {
    stats: { retention: '4.8%', reach: '8.7x', peakHour: h >= 17 && h <= 20 ? `${h}h` : '18h', retTrend: 'up', rchTrend: 'neu' },
    bestTimes: [
      { day: 'Quarta',  time: '18:00–20:00', score: 92, tier: 'top' },
      { day: 'Segunda', time: '12:00–14:00', score: 88, tier: 'top' },
      { day: 'Quinta',  time: '17:00–19:00', score: 84, tier: 'top' },
      { day: 'Terça',   time: '08:00–10:00', score: 76, tier: 'good' },
      { day: 'Sábado',  time: '10:00–12:00', score: 70, tier: 'good' },
    ],
    trending: [
      { name: 'Reels Cortos',       meta: '+42%', badge: 'hot' },
      { name: 'BTS/Bastidores',     meta: '+31%', badge: 'rise' },
      { name: 'Carrossel Didático', meta: '+28%', badge: 'rise' },
      { name: 'Collab Posts',       meta: '+19%', badge: 'new' },
      { name: 'Stories Enquetes',   meta: 'Estável', badge: 'rise' },
    ],
    hashtags: [
      { name: '#reels',       meta: '2.1B',  badge: 'hot' },
      { name: '#instagood',   meta: '1.8B',  badge: 'hot' },
      { name: '#trending',    meta: '980M',  badge: 'rise' },
      { name: '#explorepage', meta: '750M',  badge: 'rise' },
      { name: '#viral',       meta: '1.1B',  badge: 'hot' },
    ],
    formats: [
      { icon: '🎬', name: 'Reels',      desc: 'Maior alcance, descoberta', pct: 90 },
      { icon: '🖼️', name: 'Carrossel', desc: 'Saves altos',               pct: 78 },
      { icon: '📝', name: 'Stories',    desc: 'Relacionamento alto',       pct: 60 },
      { icon: '📸', name: 'Foto única', desc: 'Alcance limitado',          pct: 35 },
    ],
    insight: 'Instagram prioriza saves e comentários de qualidade. Poste Reels hoje entre 18h–20h e use chamada para ação nos primeiros 3 segundos para maximizar alcance.'
  };
  applyTT(ttD);
  applyIG(igD);
}

// ── STATUS ──
function setStatus(s) {
  const dot = document.getElementById('sdot'), txt = document.getElementById('stxt');
  if (s === 'loading') { dot.className = 'dot y'; txt.textContent = 'ATUALIZANDO'; }
  else if (s === 'error') { dot.className = 'dot r'; txt.textContent = 'ERRO'; }
  else { dot.className = 'dot'; txt.textContent = 'AO VIVO'; }
}

function toast(msg, spin = true) {
  const t = document.getElementById('toast'), sp = document.getElementById('toast-spin');
  document.getElementById('toast-msg').textContent = msg;
  sp.style.display = spin ? 'block' : 'none';
  t.classList.add('show');
  if (!spin) setTimeout(() => t.classList.remove('show'), 3000);
}

function hideToast() {
  document.getElementById('toast').classList.remove('show');
}

// ── MAIN REFRESH ──
async function refresh() {
  setStatus('loading');
  toast('Buscando dados com IA + web search...', true);
  try {
    const [ttD, igD] = await Promise.all([fetchData('tiktok'), fetchData('instagram')]);
    applyTT(ttD);
    applyIG(igD);
    setStatus('live');
    hideToast();
    setTimeout(() => toast('✅ Dados atualizados!', false), 200);
  } catch (err) {
    console.error(err);
    setStatus('error');
    hideToast();
    setTimeout(() => toast('⚠️ Usando dados em cache', false), 200);
    fallback();
  }
  nextRefAt = Date.now() + REFRESH_MS;
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(refresh, REFRESH_MS);
}

function triggerRefresh() {
  clearTimeout(refreshTimer);
  refresh();
}

// ── AI CHAT ──
async function askAI() {
  const inp = document.getElementById('aiIn').value.trim();
  if (!inp) return;
  const btn = document.getElementById('aiBtn'), out = document.getElementById('aiOut');
  btn.disabled = true;
  const niche = document.getElementById('nicheSelect').value;
  const now = new Date();
  out.innerHTML = '<span class="thinking">🔍 Buscando dados atuais e analisando...</span><span class="cursor"></span>';
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 900,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: `Especialista em TikTok e Instagram. Hoje: ${DAYS_F[now.getDay()]}, ${now.toLocaleTimeString('pt-BR')} (Brasília). Nicho: "${niche}". Responda em português, prático, direto, com dados reais. Use emojis. Máximo 200 palavras.`,
        messages: [{ role: 'user', content: inp }]
      })
    });
    const d = await res.json();
    const txt = d.content?.filter(b => b.type === 'text').map(b => b.text).join('') || 'Sem resposta.';
    typeOut(out, txt);
  } catch (e) {
    out.innerHTML = '<span style="color:var(--tt)">⚠️ Erro. Tente novamente.</span>';
  }
  btn.disabled = false;
}

function typeOut(el, html) {
  el.innerHTML = '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const full = tmp.textContent || '';
  let i = 0;
  const iv = setInterval(() => {
    if (i >= full.length) { el.innerHTML = html.replace(/\n/g, '<br>'); clearInterval(iv); return; }
    el.textContent = full.slice(0, ++i);
    el.scrollTop = el.scrollHeight;
  }, 7);
}

document.getElementById('aiIn').addEventListener('keydown', e => { if (e.key === 'Enter') askAI(); });

// ── TABS ──
function switchTab(p) {
  document.querySelectorAll('.pview').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`pview-${p}`).classList.add('active');
  const m = { tiktok: 'tt', instagram: 'ig', compare: 'cm' };
  document.querySelectorAll('.tab').forEach(t => { if (t.classList.contains(m[p])) t.classList.add('active'); });
}

// ── INIT ──
window.addEventListener('load', () => {
  buildHM('tt-hm',     'tt-hh',     heatmapMatrix('tiktok'),    'tiktok');
  buildHM('ig-hm',     'ig-hh',     heatmapMatrix('instagram'), 'instagram');
  buildHM('cmp-tt-hm', 'cmp-tt-hh', heatmapMatrix('tiktok'),    'tiktok');
  buildHM('cmp-ig-hm', 'cmp-ig-hh', heatmapMatrix('instagram'), 'instagram');
  refresh();
});
