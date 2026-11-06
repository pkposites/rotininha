import { render } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import './admin.css';
import { isInternal, setInternal, applyInternalParam } from '../lib/internal.js';
applyInternalParam();

const API = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
// Lembra o login neste aparelho (localStorage). "Sair" ou uma senha recusada apagam. Migra a sessão antiga, se houver.
const KEY = 'ninhora-admin';
const store = {
  get: () => { try { return localStorage.getItem(KEY) || sessionStorage.getItem(KEY); } catch { return null; } },
  set: (v) => { try { if (v) localStorage.setItem(KEY, v); else { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } } catch {} }
};

async function api(path, body, method) {
  const res = await fetch(API + path, { method: method ?? (body === undefined ? 'GET' : 'POST'), headers: { Authorization: 'Bearer ' + store.get(), 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { store.set(null); location.reload(); }
  return { status: res.status, ok: res.ok, ...data };
}

const pct = (v) => (v == null ? '—' : `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`);
const brl = (c) => `R$ ${(c / 100).toFixed(2).replace('.', ',')}`;
const dt = (ts) => (ts ? new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const STATUS = { draft: 'Rascunho', scheduled: 'Agendada', sending: 'Enviando', sent: 'Concluída', canceled: 'Cancelada' };
const TARGETS = [['hoje', 'Tela Hoje'], ['historico', 'Histórico'], ['saltos', 'Saltos'], ['sons', 'Sons'], ['guia', 'Guia'], ['ajustes', 'Ajustes (plano)']];
const SEGMENTS = [['all', 'Todas as famílias com notificações'], ['trial', 'Em teste grátis'], ['paid', 'Já pagaram'], ['expired', 'Acesso vencido'], ['inactive', 'Sem abrir o app há N dias'], ['no_care', 'Nunca registraram um cuidado'], ['new', 'Cadastradas nos últimos N dias'], ['leap', 'Informaram a data de nascimento (saltos)'], ['codes', 'Grupo-piloto (lista de códigos)']];

// ---------------------------------------------------------------- login
function Login() {
  const [t, setT] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const go = async (e) => {
    e.preventDefault(); setBusy(true); setErr(''); store.set(t.trim());
    const r = await fetch(API + '/v1/admin/settings', { headers: { Authorization: 'Bearer ' + t.trim() } });
    if (r.ok) location.reload(); else { store.set(null); setErr(r.status === 404 ? 'O painel está desligado no servidor (falta ADMIN_TOKEN).' : 'Token inválido.'); }
    setBusy(false);
  };
  return (
    <div class="wrap" style="max-width:420px">
      <form class="card grid" onSubmit={go}>
        <h1>Ninhora · painel</h1>
        <label class="f">Token de administração<input type="password" value={t} onInput={(e) => setT(e.target.value)} autocomplete="off" required /></label>
        {err && <p class="err" role="alert">{err}</p>}
        <button class="btn" disabled={busy}>Entrar</button>
        <p class="muted">O token fica só nesta aba (some ao fechar) e nunca é enviado a terceiros.</p>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------- gráficos simples (SVG)
function Bars({ rows, x, y, cls = 'b' }) {
  if (!rows?.length) return <p class="muted">Sem dados no período.</p>;
  const max = Math.max(1, ...rows.map(y)), w = 300 / rows.length;
  return (
    <svg class="chart" viewBox="0 0 300 90" role="img" aria-label="gráfico de barras">
      <line class="ax" x1="0" y1="80" x2="300" y2="80" />
      {rows.map((r, i) => { const h = (y(r) / max) * 70; return <rect class={cls} x={i * w + 1} y={80 - h} width={Math.max(1, w - 2)} height={h}><title>{`${x(r)}: ${y(r)}`}</title></rect>; })}
    </svg>
  );
}
const Kpi = ({ l, v, s }) => <div class="card kpi"><div class="l">{l}</div><div class="v">{v}</div>{s && <div class="s">{s}</div>}</div>;
const Meter = ({ label, rate, sub }) => (
  <div><div class="row" style="justify-content:space-between;flex-wrap:nowrap"><span>{label}</span><b>{pct(rate)}</b></div><div class="hbar"><i style={{ width: `${Math.round((rate ?? 0) * 100)}%` }} /></div>{sub && <span class="muted">{sub}</span>}</div>
);

// ---------------------------------------------------------------- visão geral
function Overview() {
  const [days, setDays] = useState(30); const [o, setO] = useState(null);
  useEffect(() => { setO(null); api('/v1/admin/overview?days=' + days).then(setO); }, [days]);
  if (!o) return <p class="muted">Carregando…</p>;
  const f = o.features, F = (k) => f[k]?.rate ?? 0;
  return (
    <div class="grid">
      <div class="row" style="justify-content:space-between"><h2>Uso do app</h2>
        <label class="f" style="max-width:180px">Período<select value={days} onChange={(e) => setDays(Number(e.target.value))}><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option></select></label></div>
      <div class="card grid"><h3>Da lista de espera ao uso (só quantidades)</h3>
        <div class="grid kpis">
          <Kpi l="Leads na lista" v={o.funnel.leads.configured ? (o.funnel.leads.total ?? '—') : 'não configurado'} s={o.funnel.leads.error ? 'Netlify indisponível agora' : o.funnel.leads.configured ? `${o.funnel.leads.inWindow}${o.funnel.leads.capped ? '+' : ''} no período` : 'falta o token do Netlify'} />
          <Kpi l="Chegaram da LP ao app" v={o.funnel.fromLp} s="abriram o app pelo link da LP" />
          <Kpi l="Instalações" v={o.funnel.installs} s="app aberto pelo ícone, no período" />
          <Kpi l="Alertas ativos" v={o.funnel.activePush} s="famílias com notificação ligada" />
          <Kpi l="Programações" v={o.funnel.remindersActive} s={`${o.funnel.remindersCreated} criadas no período`} />
          <Kpi l="Sugestões" v={o.funnel.suggestions.total} s={`${o.funnel.suggestions.inWindow} no período · ${o.funnel.suggestions.new} novas`} />
        </div>
        <p class="muted">Leads e usuárias não são ligados por pessoa: o painel só compara quantidades.</p></div>
      {o.pushFunnel && o.internal && <div class="card grid"><h3>Notificações: onde as famílias ficam pelo caminho</h3>
        <div class="grid kpis">
          <Kpi l="Viram o convite" v={o.pushFunnel.asked} s="famílias, no período" />
          <Kpi l="Ligaram" v={o.pushFunnel.enabled} s="aceitaram a permissão" />
          <Kpi l="Disseram 'agora não'" v={o.pushFunnel.later} s="o convite volta depois" />
          <Kpi l="Bloqueadas" v={o.pushFunnel.blocked} s="negaram no aparelho" />
          <Kpi l="iPhone sem instalar" v={o.pushFunnel.iosInstall} s="precisam instalar antes" />
        </div>
        <p class="muted">Só famílias reais: {o.internal.testAccounts} {o.internal.testAccounts === 1 ? 'conta de teste/interna fica' : 'contas de teste/internas ficam'} fora de todos os números{o.internal.metricsFrom ? `, e a contagem começa em ${o.internal.metricsFrom.split('-').reverse().join('/')}` : ''}. Mude isso na aba Contas.</p></div>}
      <div class="grid kpis">
        <Kpi l="Famílias cadastradas" v={o.users.total} s={`${o.users.newInWindow} novas no período`} />
        <Kpi l="Ativas hoje (DAU)" v={o.users.dau} s={`${o.users.wau} na semana · ${o.users.mau} no mês`} />
        <Kpi l="Adesão (DAU/MAU)" v={pct(o.users.stickiness)} s="quanto do mês volta todo dia" />
        <Kpi l="Ativação em 24 h" v={pct(o.activation.within24h)} s={`${pct(o.activation.within72h)} em 72 h · ${pct(o.activation.ever)} alguma vez`} />
        <Kpi l="Notificações ativadas" v={pct(o.push.optInRate)} s={`${o.push.withPush} de ${o.push.households}`} />
        <Kpi l="Teste → pagou" v={pct(o.trial.conversion)} s={`${o.trial.paid} de ${o.trial.started} testes`} />
        <Kpi l="Receita no período" v={brl(o.revenue.cents)} s={`${o.revenue.payments} pagamentos`} />
      </div>
      <div class="grid two">
        <div class="card"><h3>Famílias ativas por dia</h3><Bars rows={o.series.dau} x={(r) => r.day} y={(r) => r.n} /></div>
        <div class="card"><h3>Novos cadastros por dia</h3><Bars rows={o.series.signups} x={(r) => r.day} y={(r) => r.n} cls="b2" /></div>
      </div>
      <div class="grid two">
        <div class="card grid"><h3>Retenção (voltou a abrir no dia N)</h3>
          {['d1', 'd3', 'd7'].map((k) => <Meter label={`Dia ${k.slice(1)}`} rate={o.retention[k].rate} sub={`${o.retention[k].returned} de ${o.retention[k].cohort}`} />)}
          <p class="muted">Só entram coortes que já têm N dias de vida.</p></div>
        <div class="card grid"><h3>Quem usa cada recurso (últimos 7 dias, entre os ativos)</h3>
          {[['care_logged', 'Registrar cuidados'], ['reminder_created', 'Criar lembretes'], ['reminder_done', 'Concluir lembretes'], ['sound_played', 'Sons para a soneca'], ['leap_viewed', 'Saltos'], ['guide_lesson_done', 'Guia'], ['care_tip_opened', 'Dicas de cuidado']].map(([k, l]) => <Meter label={l} rate={F(k)} sub={`${f[k]?.households ?? 0} famílias`} />)}</div>
      </div>
      <div class="card"><h3>Notificações enviadas e cliques por dia</h3><div class="grid two"><Bars rows={o.notifications.byDay} x={(r) => r.day} y={(r) => r.sent} /><Bars rows={o.notifications.byDay} x={(r) => r.day} y={(r) => r.clicked} cls="b2" /></div></div>
      <div class="card" style="overflow:auto"><h3>Eficiência por campanha e automação</h3>
        <table><thead><tr><th>Campanha</th><th>Situação</th><th class="num">Enviadas</th><th class="num">Falhas</th><th class="num">Barradas</th><th class="num">Cliques</th><th class="num">CTR</th><th class="num">Abriram em 24 h</th></tr></thead>
          <tbody>{o.notifications.campaigns.map((c) => <tr><td>{c.name}</td><td><span class={`badge ${c.status}`}>{STATUS[c.status] ?? c.status}</span></td><td class="num">{c.sent ?? 0}</td><td class="num">{c.failed ?? 0}</td><td class="num">{c.suppressed ?? 0}</td><td class="num">{c.clicked ?? 0}</td><td class="num">{pct(c.ctr)}</td><td class="num">{pct(c.openRate24h)}</td></tr>)}</tbody></table>
        <p class="muted">“Barradas” = respeitaram o limite de 1 aviso por dia. “Abriram em 24 h” mede quem abriu o app no dia do envio ou no seguinte (não prova causa).</p></div>
      <p class="muted">Estatísticas sem dados do bebê, por pseudônimo. {o.push.usageOff} famílias desligaram a coleta; {o.push.tipsOff} desligaram as dicas.</p>
    </div>
  );
}

// ---------------------------------------------------------------- notificações (campanhas)
const EMPTY = { name: '', title: '', body: '', target: 'hoje', segment: 'all', days: 3, codes: '', when: 'now', at: '' };
function Campaigns({ seed, onSeedUsed }) {
  const [list, setList] = useState([]); const [msg, setMsg] = useState(null);
  const [f, setF] = useState(EMPTY);
  const [prev, setPrev] = useState(null); const [test, setTest] = useState('');
  const load = useCallback(() => api('/v1/admin/campaigns').then((r) => setList(r.campaigns ?? [])), []);
  useEffect(() => { load(); }, [load]);
  // "Reutilizar": copia texto, destino e público para o formulário; nada é enviado até você tocar em Enviar.
  useEffect(() => {
    if (!seed) return;
    setF({ ...EMPTY, name: seed.name ?? '', title: seed.title ?? '', body: seed.body ?? '', target: seed.target ?? 'hoje', segment: seed.segment ?? 'all', days: seed.days ?? 3 });
    setPrev(null); setMsg({ ok: seed.note ?? 'Copiado para o formulário. Revise o texto, escolha o público e toque em Enviar.' });
    onSeedUsed?.(); try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
  }, [seed]);
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setPrev(null); };
  const reuse = (c) => {
    const a = c.audience ?? {}; const piloto = a.segment === 'ids';
    setF({ ...EMPTY, name: c.name.replace(/ \(cópia\)$/, '') + ' (cópia)', title: c.title, body: c.body, target: c.target, segment: piloto ? 'all' : (a.segment ?? 'all'), days: a.days ?? 3 });
    setPrev(null); setMsg({ ok: piloto ? 'Copiado. O grupo-piloto não é copiado: escolha o público.' : 'Copiado para o formulário. Revise e toque em Enviar.' });
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
  };
  const audience = () => {
    const days = Number(f.days);
    if (f.segment === 'codes') return { segment: 'codes', codes: f.codes.split(/[\s,;]+/).filter(Boolean) };
    return ['inactive', 'no_care', 'new'].includes(f.segment) ? { segment: f.segment, days } : { segment: f.segment };
  };
  const preview = async () => { const r = await api('/v1/admin/campaigns/preview', { audience: audience() }); setPrev(r.ok ? r : { error: r.error }); };
  const create = async (draft) => {
    const sendAt = f.when === 'at' && f.at ? new Date(f.at).getTime() : undefined;
    const r = await api('/v1/admin/campaigns', { name: f.name || f.title, title: f.title, body: f.body, target: f.target, audience: audience(), sendAt, draft });
    if (r.ok) { setMsg({ ok: draft ? 'Rascunho salvo.' : f.when === 'at' ? 'Campanha agendada.' : 'Campanha na fila: sai no próximo minuto, respeitando silêncio e limites.' }); load(); }
    else setMsg({ err: { bad_request: 'Confira nome, título (até 60), texto (até 180), destino e público.', code_not_found: 'Algum código não existe.', no_codes: 'Informe ao menos um código.', bad_schedule: 'Data de envio inválida.' }[r.error] ?? 'Não foi possível salvar.' });
  };
  const act = async (id, action) => { await api('/v1/admin/campaigns/action', { id, action }); load(); };
  const sendTest = async () => {
    const r = await api('/v1/admin/campaigns/test', { code: test.trim(), title: f.title || 'Teste', body: f.body || 'Teste de notificação', target: f.target });
    setMsg(r.result === 'sent' ? { ok: 'Teste enviado ao aparelho.' } : { err: r.error === 'code_not_found' ? 'Código não encontrado.' : 'Não chegou: o aparelho precisa ter as notificações ativadas.' });
  };
  return (
    <div class="grid two">
      <div class="card grid">
        <h2>Nova notificação</h2>
        <label class="f">Nome interno<input value={f.name} onInput={set('name')} maxLength="80" placeholder="Ex.: Lançamento dos sons" /></label>
        <label class="f">Título ({f.title.length}/60)<input value={f.title} onInput={set('title')} maxLength="60" /></label>
        <label class="f">Texto ({f.body.length}/180)<textarea value={f.body} onInput={set('body')} maxLength="180" /></label>
        <p class="muted">Variáveis: <code>{'{dias}'}</code> dias que faltam do teste · <code>{'{preco}'}</code> preço do acesso vitalício. Sem promessas médicas e sem dados do bebê.</p>
        <label class="f">Ao tocar, abre<select value={f.target} onChange={set('target')}>{TARGETS.map(([v, l]) => <option value={v}>{l}</option>)}</select></label>
        <label class="f">Público<select value={f.segment} onChange={set('segment')}>{SEGMENTS.map(([v, l]) => <option value={v}>{l}</option>)}</select></label>
        {['inactive', 'no_care', 'new'].includes(f.segment) && <label class="f">Dias<input type="number" min="1" max="365" value={f.days} onInput={set('days')} /></label>}
        {f.segment === 'codes' && <label class="f">Códigos de acesso (um por linha)<textarea value={f.codes} onInput={set('codes')} placeholder="XXXXX-XXXXX-XXXXX-XXXXX" /></label>}
        <div class="row"><button class="btn ghost" onClick={preview} type="button">Quantas famílias recebem?</button>
          {prev && <span class={prev.error ? 'err' : 'ok'}>{prev.error ? 'Confira o público.' : `${prev.reachable} podem receber (de ${prev.segment} no público)`}</span>}</div>
        <div class="row"><label class="f"><span>Quando</span><select value={f.when} onChange={set('when')}><option value="now">Agora</option><option value="at">Agendar</option></select></label>
          {f.when === 'at' && <label class="f">Data e hora<input type="datetime-local" value={f.at} onInput={set('at')} /></label>}</div>
        <div class="row"><button class="btn" onClick={() => create(false)} disabled={!f.title || !f.body}>{f.when === 'at' ? 'Agendar' : 'Enviar'}</button><button class="btn ghost" onClick={() => create(true)} disabled={!f.title || !f.body}>Salvar rascunho</button></div>
        <p class="muted">Cada família recebe no máximo 1 aviso promocional a cada 20 h, nunca entre 22h e 6h (fuso dela), e só se aceitou “dicas e novidades”.</p>
        <hr />
        <div class="row"><label class="f">Testar em um aparelho (código de acesso)<input value={test} onInput={(e) => setTest(e.target.value)} placeholder="XXXXX-XXXXX-XXXXX-XXXXX" /></label><button class="btn ghost" onClick={sendTest} disabled={!test}>Enviar teste</button></div>
        {msg?.ok && <p class="ok" role="status">{msg.ok}</p>}{msg?.err && <p class="err" role="alert">{msg.err}</p>}
      </div>
      <div class="grid" style="align-content:start">
        <div class="card grid"><h3>Como vai aparecer</h3>
          <div class="notif"><small>NINHORA · agora</small><b>{f.title || 'Título da notificação'}</b><span>{f.body || 'O texto aparece aqui.'}</span></div></div>
        <div class="card" style="overflow:auto"><h3>Campanhas</h3>
          <table><thead><tr><th>Nome</th><th>Situação</th><th class="num">Env.</th><th class="num">Cliques</th><th /></tr></thead>
            <tbody>{list.map((c) => <tr><td><b>{c.name}</b><br /><span class="muted">{dt(c.scheduled_at ?? c.created_at)}</span></td><td><span class={`badge ${c.status}`}>{STATUS[c.status] ?? c.status}</span></td><td class="num">{c.sent}</td><td class="num">{c.clicked}</td>
              <td><button class="btn ghost" onClick={() => reuse(c)}>Reutilizar</button> {['draft', 'scheduled'].includes(c.status) && <button class="btn ghost" onClick={() => act(c.id, 'send_now')}>Enviar</button>} {['draft', 'scheduled', 'sending'].includes(c.status) && <button class="btn danger" onClick={() => act(c.id, 'cancel')}>Cancelar</button>}</td></tr>)}</tbody></table>
          {!list.length && <p class="muted">Nenhuma campanha ainda.</p>}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- automações
const AUTO_AUDIENCE = { welcome: ['new', 7], first_care: ['no_care', 7], first_reminder: ['all', 3], sounds_tip: ['all', 3], leap_coming: ['leap', 3], trial_ends_tomorrow: ['trial', 3], trial_last_day: ['trial', 3], trial_ended: ['expired', 3], inactive_3d: ['inactive', 3] };
const DAYS_SEG = ['inactive', 'no_care', 'new'];

// Envio manual de uma automação: escolhe o público, vê quantas famílias recebem, confirma. Vira uma campanha comum (respeita silêncio e limites).
function SendNow({ a, onClose, onEdit }) {
  const [seg, d0] = AUTO_AUDIENCE[a.key] ?? ['all', 3];
  const [segment, setSegment] = useState(seg); const [days, setDays] = useState(d0); const [n, setN] = useState(null); const [res, setRes] = useState(null); const [busy, setBusy] = useState(false);
  const aud = () => (DAYS_SEG.includes(segment) ? { segment, days: Number(days) } : { segment });
  useEffect(() => { setN(null); api('/v1/admin/campaigns/preview', { audience: aud() }).then((r) => setN(r.ok ? r.reachable : 'erro')); }, [segment, days]);
  const send = async () => {
    if (!n || n === 'erro') return;
    if (!window.confirm(`Enviar "${a.title}" agora para ${n} ${n === 1 ? 'família' : 'famílias'}? Não dá para desfazer depois que sair.`)) return;
    setBusy(true);
    const r = await api('/v1/admin/campaigns', { name: `Automação: ${a.label} (manual)`, title: a.title, body: a.body, target: a.target, audience: aud() });
    setBusy(false); setRes(r.ok ? { ok: `Na fila para ${n}: sai no próximo minuto, respeitando silêncio e limite de 1 aviso a cada 20 h.` } : { err: 'Não foi possível enviar. Confira título e texto.' });
  };
  return (
    <div class="card grid" style="background:var(--soft,transparent)">
      <b>Enviar agora esta mensagem</b>
      <div class="row"><label class="f">Para quem<select value={segment} onChange={(e) => setSegment(e.target.value)}>{SEGMENTS.filter(([v]) => v !== 'codes').map(([v, l]) => <option value={v}>{l}</option>)}</select></label>
        {DAYS_SEG.includes(segment) && <label class="f">Dias<input type="number" min="1" max="365" value={days} onInput={(e) => setDays(e.target.value)} /></label>}</div>
      <p class={n === 'erro' ? 'err' : 'muted'}>{n == null ? 'Contando…' : n === 'erro' ? 'Confira o público.' : `${n} ${n === 1 ? 'família pode receber' : 'famílias podem receber'} (só quem ligou as notificações e aceitou novidades).`}</p>
      <div class="row"><button class="btn" disabled={busy || !n || n === 'erro'} onClick={send}>Enviar agora</button><button class="btn ghost" onClick={() => onEdit(a, aud())}>Editar na aba Notificações</button><button class="link" onClick={onClose}>Fechar</button></div>
      {res?.ok && <p class="ok" role="status">{res.ok}</p>}{res?.err && <p class="err" role="alert">{res.err}</p>}
    </div>
  );
}

function Automations({ onReuse }) {
  const [list, setList] = useState([]); const [saved, setSaved] = useState(''); const [open, setOpen] = useState(null);
  const load = useCallback(() => api('/v1/admin/automations').then((r) => setList(r.automations ?? [])), []);
  useEffect(() => { load(); }, [load]);
  const upd = (key, patch) => setList(list.map((a) => (a.key === key ? { ...a, ...patch } : a)));
  const save = async (a, enabledOnly) => { await api('/v1/admin/automations', enabledOnly ? { key: a.key, enabled: a.enabled } : { key: a.key, enabled: a.enabled, title: a.title, body: a.body, target: a.target }); setSaved(a.key); load(); };
  return (
    <div class="grid">
      <h2>Automações do ciclo de vida</h2>
      <p class="muted">Mensagens que saem sozinhas quando a pessoa cumpre uma regra. Todas começam <b>desligadas</b>. Respeitam silêncio (22h–6h) e o limite de 1 aviso promocional a cada 20 h (avisos do teste e da cobrança ignoram o limite).</p>
      {list.map((a) => (
        <div class="card grid">
          <div class="row" style="justify-content:space-between;align-items:center"><div><h3>{a.label}</h3><span class="muted">{a.when}</span></div>
            <label class="sw"><input type="checkbox" checked={a.enabled} onChange={(e) => { const n = { ...a, enabled: e.target.checked }; upd(a.key, { enabled: n.enabled }); save(n, true); }} /> {a.enabled ? 'Ligada' : 'Desligada'}</label></div>
          <div class="row"><label class="f">Título<input value={a.title} maxLength="60" onInput={(e) => upd(a.key, { title: e.target.value })} /></label>
            <label class="f">Ao tocar abre<select value={a.target} onChange={(e) => upd(a.key, { target: e.target.value })}>{TARGETS.map(([v, l]) => <option value={v}>{l}</option>)}</select></label></div>
          <label class="f">Texto<textarea maxLength="180" value={a.body} onInput={(e) => upd(a.key, { body: e.target.value })} /></label>
          <div class="row" style="align-items:center"><button class="btn ghost" onClick={() => save(a)}>Salvar texto</button><button class="btn" onClick={() => setOpen(open === a.key ? null : a.key)}>Enviar agora</button>
            <span class="muted">{a.sent} enviadas · {a.clicked} cliques · CTR {pct(a.sent ? a.clicked / a.sent : null)}</span>{saved === a.key && <span class="ok">Salvo</span>}</div>
          {open === a.key && <SendNow a={a} onClose={() => setOpen(null)} onEdit={(x, aud) => onReuse({ name: `Automação: ${x.label}`, title: x.title, body: x.body, target: x.target, segment: aud.segment, days: aud.days })} />}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- cobrança do teste
function Billing() {
  const [s, setS] = useState(null); const [f, setF] = useState({ days: 3, notice: 7, from: '' }); const [msg, setMsg] = useState(null);
  const load = useCallback(() => api('/v1/admin/settings').then((r) => { setS(r); setF({ days: r.trialDays, notice: r.noticeDays, from: r.enforceFrom ? new Date(r.enforceFrom).toISOString().slice(0, 10) : '' }); }), []);
  useEffect(() => { load(); }, [load]);
  if (!s) return <p class="muted">Carregando…</p>;
  const minDate = new Date(Date.now() + f.notice * 86400000).toISOString().slice(0, 10);
  const save = async () => {
    const from = f.from ? new Date(f.from + 'T00:00:00').getTime() : undefined;
    if (from && !s.active && from < Date.now() + f.notice * 86400000 - 86400000) { setMsg({ err: `Aviso prévio insuficiente: a data precisa ser ${new Date(minDate + 'T00:00:00').toLocaleDateString('pt-BR')} ou depois.` }); return; }
    if (from && !s.active && !window.confirm(`Confirmar: a cobrança começa em ${new Date(from).toLocaleDateString('pt-BR')}. Quem já está no teste ganha ${f.days} dias a partir dessa data, e todos serão avisados antes. Continuar?`)) return;
    const r = await api('/v1/admin/settings', { trialDays: Number(f.days), noticeDays: Number(f.notice), ...(from ? { enforceFrom: from } : {}) });
    setMsg(r.ok ? { ok: 'Salvo.' } : { err: r.error === 'notice_required' ? `Aviso prévio insuficiente: a data precisa ser ${new Date(r.minFrom).toLocaleDateString('pt-BR')} ou depois.` : 'Não foi possível salvar.' }); load();
  };
  return (
    <div class="grid" style="max-width:640px">
      <h2>Teste grátis e cobrança</h2>
      <div class={`card ${s.active ? 'err' : ''}`}>{s.active ? <b>Cobrança em vigor.</b> : s.enforceFrom ? <b>Cobrança agendada para {new Date(s.enforceFrom).toLocaleDateString('pt-BR')}.</b> : <b>Pré-lançamento: ninguém é cobrado.</b>}
        <p class="muted">{s.trials} famílias em teste{s.trialsWithoutEnd ? ` (${s.trialsWithoutEnd} ainda sem data de fim)` : ''}.</p>
        {s.enforceFrom && !s.payments && <p class="err" role="alert"><b>Atenção:</b> o pagamento está <b>desligado</b> no servidor. Por segurança, a cobrança e o bloqueio <b>não entram em vigor</b> nesta data enquanto o pagamento não for ligado — ninguém é bloqueado sem ter como pagar.</p>}</div>
      <div class="card grid">
        <label class="f">Duração do teste (dias)<input type="number" min="1" max="30" value={f.days} onInput={(e) => setF({ ...f, days: e.target.value })} /></label>
        <label class="f">Aviso prévio mínimo (dias)<input type="number" min="1" max="60" value={f.notice} onInput={(e) => setF({ ...f, notice: e.target.value })} /></label>
        <label class="f">Começo da cobrança<input type="date" min={minDate} value={f.from} onInput={(e) => setF({ ...f, from: e.target.value })} disabled={s.active} /></label>
        <p class="muted">A data precisa respeitar o aviso prévio (a partir de {new Date(minDate).toLocaleDateString('pt-BR')}). Dentro da janela, o app mostra um aviso a todos. Quem já está no teste não perde nada: ganha {f.days} dias a partir da data. Depois de em vigor, a cobrança não pode ser desfeita por aqui. Para cobrar de verdade, o pagamento também precisa estar ligado e validado (<code>PAYMENTS_ENABLED</code>).</p>
        <button class="btn" onClick={save}>Salvar</button>
        {msg?.ok && <p class="ok" role="status">{msg.ok}</p>}{msg?.err && <p class="err" role="alert">{msg.err}</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- compras + aviso no celular
const b64uToBytes = (str) => { const p = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4); return Uint8Array.from(atob(p), (c) => c.charCodeAt(0)); };
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
const adminReg = async () => (await navigator.serviceWorker.getRegistration('/admin/')) ?? navigator.serviceWorker.register('/sw.js', { scope: '/admin/' }).then(() => navigator.serviceWorker.getRegistration('/admin/')).then(async (r) => { await navigator.serviceWorker.ready; return r; });
const PAY = { approved: ['Pago', 'sent'], refunded: ['Reembolsado', 'canceled'], pending: ['Aguardando Pix', 'scheduled'], failed: ['Não concluído', 'draft'], mismatch: ['Valor divergente', 'canceled'] };

function PushToggle() {
  const [st, setSt] = useState('...'); const [msg, setMsg] = useState(null); const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return setSt(isIOS() ? 'ios-install' : 'unsupported');
    if (isIOS() && !standalone()) return setSt('ios-install');
    if (Notification.permission === 'denied') return setSt('denied');
    try { const r = await navigator.serviceWorker.getRegistration('/admin/'); if (r && Notification.permission === 'granted' && (await r.pushManager.getSubscription())) return setSt('active'); } catch {}
    setSt('idle');
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const on = async () => {
    setBusy(true); setMsg(null);
    try {
      if ((await Notification.requestPermission()) !== 'granted') throw new Error('Sem a permissão do aparelho o aviso não chega.');
      const { publicKey } = await (await fetch(API + '/v1/push/key')).json();
      const reg = await adminReg();
      let sub = await reg.pushManager.getSubscription();
      const key = b64uToBytes(publicKey);
      if (sub && !(sub.options?.applicationServerKey && new Uint8Array(sub.options.applicationServerKey).every((v, i) => v === key[i]))) { try { await sub.unsubscribe(); } catch {} sub = null; }
      sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      const j = sub.toJSON();
      const r = await api('/v1/admin/push/subscribe', { endpoint: j.endpoint, keys: j.keys });
      if (!r.ok) throw new Error(r.error === 'too_many_devices' ? 'Aparelhos demais cadastrados (limite 10).' : 'Não foi possível ativar agora.');
      const t = await api('/v1/admin/push/test', {});
      setMsg({ ok: t.sent ? 'Ativado! Mandei um aviso de teste.' : 'Ativado, mas o aviso de teste não saiu agora.' });
    } catch (e) { setMsg({ err: e.message || 'Não foi possível ativar.' }); }
    setBusy(false); refresh();
  };
  const off = async () => {
    setBusy(true);
    try { const r = await navigator.serviceWorker.getRegistration('/admin/'); const sub = await r?.pushManager.getSubscription(); if (sub) { await api('/v1/admin/push/unsubscribe', { endpoint: sub.endpoint }); await sub.unsubscribe(); } } catch {}
    setBusy(false); setMsg({ ok: 'Avisos desligados neste aparelho.' }); refresh();
  };
  const test = async () => { setBusy(true); const t = await api('/v1/admin/push/test', {}); setMsg(t.sent ? { ok: 'Aviso de teste enviado.' } : { err: 'Nenhum aparelho recebeu o teste.' }); setBusy(false); };
  return (
    <div class="card grid"><h3>Avisos de compra no celular</h3>
      {st === 'active' && <><p>Este aparelho recebe um aviso a cada <b>compra</b> e <b>reembolso</b>. ✅</p><div class="row"><button class="btn ghost" disabled={busy} onClick={test}>Enviar teste</button><button class="btn ghost" disabled={busy} onClick={off}>Desligar</button></div></>}
      {st === 'idle' && <><p class="muted">Toque para o aparelho te avisar na hora de cada venda, mesmo com o painel fechado.</p><button class="btn" disabled={busy} onClick={on}>{busy ? 'Ativando…' : 'Ativar avisos neste aparelho'}</button></>}
      {st === 'ios-install' && <p class="muted">No iPhone, abra este painel no Safari, toque em Compartilhar → <b>Adicionar à Tela de Início</b>, abra o painel pelo ícone novo e volte aqui para ativar.</p>}
      {st === 'denied' && <p class="err">As notificações estão bloqueadas para este painel. Libere nas configurações do aparelho/navegador.</p>}
      {st === 'unsupported' && <p class="muted">Este navegador não oferece notificações para sites.</p>}
      {msg?.ok && <p class="ok" role="status">{msg.ok}</p>}{msg?.err && <p class="err" role="alert">{msg.err}</p>}
    </div>
  );
}

function Purchases() {
  const [d, setD] = useState(null);
  const load = useCallback(() => api('/v1/admin/purchases').then(setD), []);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);
  return (
    <div class="grid" style="max-width:720px">
      <h2>Compras</h2>
      <PushToggle />
      {!d ? <p class="muted">Carregando…</p> : (
        <div class="card" style="overflow:auto"><h3>Últimas compras</h3>
          <p class="muted">{d.paid} {d.paid === 1 ? 'acesso ativo' : 'acessos ativos'} · {brl(d.cents)} em vendas (sem reembolsos).</p>
          {d.purchases.length === 0 ? <p class="muted">Ainda não há compras.</p> : (
            <table><thead><tr><th>Data</th><th>Valor</th><th>Situação</th><th>Pagador</th><th>Ref.</th></tr></thead>
              <tbody>{d.purchases.map((r) => <tr><td>{dt(r.at)}</td><td>{brl(r.cents)}</td><td><span class={`badge ${PAY[r.status]?.[1] ?? 'draft'}`}>{PAY[r.status]?.[0] ?? r.status}</span>{r.refundedAt ? <span class="muted"> · {dt(r.refundedAt)}</span> : null}</td><td>{r.email}</td><td>…{r.ref}</td></tr>)}</tbody></table>)}
          <p class="muted">Atualiza sozinho a cada 30 s. Pix não pago some da lista depois de 24 h.</p></div>)}
    </div>
  );
}

// ---------------------------------------------------------------- famílias: excluir cadastro pelo WhatsApp
function Families() {
  const [wa, setWa] = useState(''); const [info, setInfo] = useState(null); const [msg, setMsg] = useState(null); const [busy, setBusy] = useState(false);
  const [dev, setDev] = useState(isInternal()); const [from, setFrom] = useState(''); const [fromMsg, setFromMsg] = useState('');
  useEffect(() => { api('/v1/admin/metrics-from').then((r) => setFrom(r.day ?? '')); }, []);
  const look = async () => { setBusy(true); setMsg(null); const r = await api('/v1/admin/households/lookup', { whatsapp: wa }); setBusy(false); setInfo(r.status === 422 ? { bad: true } : r); };
  const del = async (allowPaid) => {
    const q = allowPaid ? 'Esta conta TEM compra ativa. Excluir mesmo assim? O acesso pago será perdido e não dá para desfazer.' : `Excluir definitivamente esta conta e os ${info.records} registros dela? Não dá para desfazer.`;
    if (!window.confirm(q)) return;
    setBusy(true); const r = await api('/v1/admin/households/delete', { whatsapp: wa, confirm: true, allowPaid: !!allowPaid }); setBusy(false);
    if (r.deleted) { setMsg({ ok: 'Conta excluída.' }); setInfo(null); setWa(''); }
    else if (r.error === 'has_payment') setInfo({ ...info, needPaid: true });
    else setMsg({ err: 'Não foi possível excluir.' });
  };
  const flag = async (test) => { setBusy(true); const r = await api('/v1/admin/households/test-flag', { whatsapp: wa, test }); setBusy(false); if (r.updated) { setInfo({ ...info, isTest: test }); setMsg({ ok: test ? 'Marcada como conta de teste: some das métricas.' : 'Voltou a contar nas métricas.' }); } else setMsg({ err: 'Não foi possível alterar.' }); };
  const toggleDev = (on) => { setInternal(on); setDev(on); };
  const saveFrom = async (day) => { const r = await api('/v1/admin/metrics-from', { day: day || null }); setFromMsg(r.ok ? (day ? 'Salvo: as métricas contam a partir dessa data.' : 'Removido: contando tudo.') : 'Não foi possível salvar.'); };
  return (
    <div class="grid" style="max-width:560px">
      <h2>Contas e métricas</h2>
      <div class="card grid">
        <h3>Procurar uma conta</h3>
        <p class="muted">Digite o WhatsApp da conta no app. O número não é guardado: o servidor confere por um código embaralhado.</p>
        <label class="f">WhatsApp<input type="tel" inputmode="tel" placeholder="(11) 91234-5678" value={wa} onInput={(e) => { setWa(e.target.value); setInfo(null); setMsg(null); }} /></label>
        <button class="btn" disabled={busy || wa.replace(/\D/g, '').length < 10} onClick={look}>Procurar conta</button>
        {info?.bad && <p class="err" role="alert">Número inválido.</p>}
        {info && info.found === false && <p class="muted">Nenhuma conta com esse número.</p>}
        {info?.found && (
          <div class="grid">
            <p>Conta encontrada: <b>{info.plan === 'paid' ? 'com acesso pago' : 'em teste grátis'}</b>, criada em {dt(info.createdAt)}, com <b>{info.records}</b> registros{info.activePurchases ? <> e <b>{info.activePurchases} compra(s) ativa(s)</b></> : null}. {info.isTest ? <b>É uma conta de teste (fora das métricas).</b> : 'Conta real (conta nas métricas).'}</p>
            <button class="btn ghost" disabled={busy} onClick={() => flag(!info.isTest)}>{info.isTest ? 'Voltar a contar nas métricas' : 'Marcar como conta de teste'}</button>
            {info.activePurchases > 0 && !info.needPaid && <p class="err">Esta conta tem compra ativa. Reembolse antes, se for o caso.</p>}
            <button class="btn danger" disabled={busy} onClick={() => del(info.needPaid)}>{info.needPaid ? 'Excluir mesmo com compra ativa' : 'Excluir definitivamente'}</button>
          </div>)}
        {msg?.ok && <p class="ok" role="status">{msg.ok}</p>}{msg?.err && <p class="err" role="alert">{msg.err}</p>}
      </div>
      <div class="card grid">
        <h3>Este aparelho é meu (interno)</h3>
        <p class="muted">Ligado, o que você faz neste navegador (visitas à página, abertura do app, cliques) não entra nas métricas, e contas criadas aqui já nascem marcadas como teste. Vale só para este aparelho e navegador. No app instalado na tela inicial do iPhone, que guarda dados à parte, marque a conta pelo WhatsApp acima ou abra uma vez <code>…/app/?interno=1</code>.</p>
        <label class="inline" style="display:flex;gap:10px;align-items:center"><input type="checkbox" checked={dev} onChange={(e) => toggleDev(e.target.checked)} style="width:22px;height:22px" /> {dev ? 'Aparelho interno: ligado' : 'Aparelho interno: desligado'}</label>
      </div>
      <div class="card grid">
        <h3>Contar as métricas a partir de</h3>
        <p class="muted">Descarta o período de testes antes do lançamento sem apagar nada. Deixe vazio para contar tudo.</p>
        <label class="f">Data de início<input type="date" value={from} onInput={(e) => { setFrom(e.target.value); setFromMsg(''); }} /></label>
        <div class="row"><button class="btn" onClick={() => saveFrom(from)}>Salvar</button>{from && <button class="btn ghost" onClick={() => { setFrom(''); saveFrom(''); }}>Limpar</button>}</div>
        {fromMsg && <p class="ok" role="status">{fromMsg}</p>}
      </div>
    </div>
  );
}

function App() {
  const [seed, setSeed] = useState(null);
  const [tab, setTab] = useState(() => { const t = new URLSearchParams(location.search).get('tab'); return ['geral', 'compras', 'familias', 'notif', 'auto', 'cobranca'].includes(t) ? t : 'geral'; });
  if (!store.get()) return <Login />;
  const TABS = [['geral', 'Visão geral'], ['compras', 'Compras'], ['familias', 'Contas'], ['notif', 'Notificações'], ['auto', 'Automações'], ['cobranca', 'Teste e cobrança']];
  return (
    <div class="wrap">
      <div class="bar"><h1>Ninhora · painel</h1>
        <nav class="tabs" aria-label="Seções">{TABS.map(([k, l]) => <button class="tab" aria-current={tab === k ? 'page' : undefined} onClick={() => setTab(k)}>{l}</button>)}</nav>
        <button class="btn ghost" onClick={() => { store.set(null); location.reload(); }}>Sair</button></div>
      {tab === 'geral' && <Overview />}{tab === 'compras' && <Purchases />}{tab === 'familias' && <Families />}{tab === 'notif' && <Campaigns seed={seed} onSeedUsed={() => setSeed(null)} />}{tab === 'auto' && <Automations onReuse={(x) => { setSeed(x); setTab('notif'); }} />}{tab === 'cobranca' && <Billing />}
    </div>
  );
}
render(<App />, document.getElementById('root'));
