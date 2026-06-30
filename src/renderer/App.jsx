import React, { useEffect, useState, useCallback } from 'react';

const api = window.cosmi;

const ERR = {
  SENHA_INCORRETA: 'Senha mestra incorreta.',
  SENHA_CURTA: 'A senha precisa ter pelo menos 8 caracteres.',
  SEM_BANCO: 'Nenhum banco encontrado.',
  JA_EXISTE: 'Já existe um banco neste computador.',
  BACKUP_INVALIDO: 'A pasta escolhida não é um backup válido.',
  TRAVADO: 'O app está travado.',
};
const msg = (e) => ERR[e?.message] || e?.message || 'Erro inesperado.';

const STRENGTH_COLORS = ['#d9534f', '#d9534f', '#e0a93b', '#e0a93b', '#4caf72', '#4caf72'];

export default function App() {
  const [view, setView] = useState('loading'); // loading | setup | unlock | dashboard
  const refreshStatus = useCallback(async () => {
    const s = await api.status();
    if (s.unlocked) setView('dashboard');
    else if (s.hasDatabase) setView('unlock');
    else setView('setup');
  }, []);

  useEffect(() => { refreshStatus(); }, [refreshStatus]);

  if (view === 'loading') return <div className="center-screen"><div className="muted">Carregando…</div></div>;
  if (view === 'setup') return <Setup onDone={refreshStatus} />;
  if (view === 'unlock') return <Unlock onDone={refreshStatus} />;
  return <Dashboard onLock={refreshStatus} />;
}

function Setup({ onDone }) {
  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [strength, setStrength] = useState({ score: 0, label: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pwd) { setStrength({ score: 0, label: '' }); return; }
    api.passwordStrength(pwd).then(setStrength);
  }, [pwd]);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (pwd.length < 8) return setErr(ERR.SENHA_CURTA);
    if (pwd !== confirm) return setErr('As senhas não conferem.');
    setBusy(true);
    try {
      await api.setup(pwd);
      onDone();
    } catch (e2) { setErr(msg(e2)); } finally { setBusy(false); }
  }

  return (
    <div className="center-screen">
      <form className="card" onSubmit={submit}>
        <h1>Criar senha mestra</h1>
        <p className="sub">
          Esta senha protege todo o prontuário (criptografia em repouso, SQLCipher).
          <b> Não há recuperação:</b> se esquecê-la, os dados ficam inacessíveis. Guarde-a com cuidado.
        </p>
        <label>Senha mestra</label>
        <input type="password" value={pwd} autoFocus onChange={(e) => setPwd(e.target.value)} />
        <div className="strength">
          <div style={{ width: `${(strength.score / 5) * 100}%`, background: STRENGTH_COLORS[strength.score] }} />
        </div>
        <div className="hint">{strength.label ? `Força: ${strength.label}` : 'Mínimo de 8 caracteres. Recomendado: 12+ com símbolos.'}</div>

        <label>Confirmar senha</label>
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />

        <div className="err">{err}</div>
        <button className="primary full" disabled={busy}>{busy ? 'Criando…' : 'Criar e abrir'}</button>
      </form>
    </div>
  );
}

function Unlock({ onDone }) {
  const [pwd, setPwd] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try { await api.unlock(pwd); onDone(); }
    catch (e2) { setErr(msg(e2)); setBusy(false); }
  }

  return (
    <div className="center-screen">
      <form className="card" onSubmit={submit}>
        <h1>Cosmi</h1>
        <p className="sub">Digite a senha mestra para abrir o prontuário.</p>
        <label>Senha mestra</label>
        <input type="password" value={pwd} autoFocus onChange={(e) => setPwd(e.target.value)} />
        <div className="err">{err}</div>
        <button className="primary full" disabled={busy}>{busy ? 'Abrindo…' : 'Destravar'}</button>
      </form>
    </div>
  );
}

function Dashboard({ onLock }) {
  const [health, setHealth] = useState(null);
  const [backups, setBackups] = useState([]);
  const [counts, setCounts] = useState({});
  const [settings, setSettings] = useState(null);
  const [status, setStatus] = useState(null);
  const [toast, setToast] = useState('');
  const [restoreFor, setRestoreFor] = useState(null);
  const [changePwd, setChangePwd] = useState(false);

  const reload = useCallback(async () => {
    const [h, b, c, s, st] = await Promise.all([
      api.backupHealth(), api.listBackups(), api.dbCounts(), api.getBackupSettings(), api.status(),
    ]);
    setHealth(h); setBackups(b); setCounts(c); setSettings(s); setStatus(st);
  }, []);

  useEffect(() => {
    reload();
    const off = api.onBackupChanged(reload);
    return off;
  }, [reload]);

  function flash(t) { setToast(t); setTimeout(() => setToast(''), 2500); }

  async function backupNow() {
    try { await api.backupNow(); flash('Backup criado.'); reload(); }
    catch (e) { flash(msg(e)); }
  }
  async function lock() { await api.lock(); onLock(); }

  return (
    <div className="app">
      <div className="topbar">
        <div>
          <h1>Cosmi — Segurança & Backup</h1>
          <div className="brand-note">Registro de apoio. Não substitui o prontuário oficial.</div>
        </div>
        <div className="row">
          <button onClick={() => setChangePwd(true)}>Trocar senha</button>
          <button onClick={lock}>Travar</button>
        </div>
      </div>

      {health && (health.neverBackedUp || health.stale ? (
        <div className="banner warn">
          ⚠️ {health.neverBackedUp
            ? 'Nenhum backup foi feito ainda.'
            : `O último backup foi há ${health.ageDays} dia(s) — acima do limite configurado.`}
          <div className="spacer" />
          <button onClick={backupNow}>Fazer backup agora</button>
        </div>
      ) : (
        <div className="banner ok">
          ✓ Backup em dia. Último: {fmtDate(health.lastBackupAt)}.
        </div>
      ))}

      <div className="grid2">
        <div className="panel">
          <h2>Estado do banco</h2>
          <div className="kv"><span>Criptografia</span><span>SQLCipher (AES-256) · chave Argon2id</span></div>
          <div className="kv"><span>Local dos dados</span><span className="mono">{status?.userDataDir || '—'}</span></div>
          <div className="kv"><span>Registros</span><span>{Object.values(counts).reduce((a, b) => a + b, 0)} no total</span></div>
          {Object.entries(counts).map(([k, v]) => (
            <div className="kv" key={k}><span>{k}</span><span>{v}</span></div>
          ))}
        </div>

        <div className="panel">
          <h2>Backup</h2>
          <div className="kv"><span>Pasta</span><span className="mono">{settings?.backupDir || '—'}</span></div>
          <div className="kv"><span>Manter (rotação)</span><span>{settings?.retention} backups</span></div>
          <div className="kv"><span>Automático a cada</span><span>{settings?.autoIntervalHours} h</span></div>
          <div className="kv"><span>Avisar após</span><span>{settings?.warnDays} dias</span></div>
          <div className="row" style={{ marginTop: 14 }}>
            <button className="primary" onClick={backupNow}>Backup agora</button>
            <button onClick={async () => { await api.openBackupFolder(); }}>Abrir pasta</button>
            <BackupSettingsButton settings={settings} onSaved={reload} />
          </div>
        </div>
      </div>

      <div className="panel">
        <h2>Backups disponíveis ({backups.length})</h2>
        {backups.length === 0 ? <div className="muted">Nenhum backup ainda.</div> : (
          <table>
            <thead><tr><th>Data/hora</th><th>Tipo</th><th>Tamanho</th><th></th></tr></thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.name}>
                  <td>{fmtDate(b.createdAt) || b.name}</td>
                  <td><span className={`tag ${b.reason === 'pre-restore' ? 'pre' : ''}`}>{labelReason(b.reason)}</span></td>
                  <td>{fmtSize(b.sizeBytes)}</td>
                  <td><button onClick={() => setRestoreFor(b)} disabled={!b.valid}>Restaurar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="hint" style={{ marginTop: 12 }}>
          Lembrete: teste uma restauração de verdade de tempos em tempos. Backup que você nunca restaurou não é backup.
        </div>
      </div>

      {toast && <div className="banner ok" style={{ position: 'fixed', bottom: 18, right: 18, margin: 0 }}>{toast}</div>}

      {restoreFor && <RestoreModal backup={restoreFor} onClose={() => setRestoreFor(null)} onDone={() => { setRestoreFor(null); reload(); flash('Backup restaurado.'); }} />}
      {changePwd && <ChangePasswordModal onClose={() => setChangePwd(false)} onDone={() => { setChangePwd(false); flash('Senha alterada.'); }} />}
    </div>
  );
}

function BackupSettingsButton({ settings, onSaved }) {
  const [open, setOpen] = useState(false);
  const [retention, setRetention] = useState(settings?.retention ?? 14);
  const [warnDays, setWarnDays] = useState(settings?.warnDays ?? 7);
  const [autoHours, setAutoHours] = useState(settings?.autoIntervalHours ?? 24);
  const [dir, setDir] = useState(settings?.backupDir ?? '');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open && settings) {
      setRetention(settings.retention); setWarnDays(settings.warnDays);
      setAutoHours(settings.autoIntervalHours); setDir(settings.backupDir);
    }
  }, [open, settings]);

  async function save() {
    setErr('');
    try {
      await api.setBackupSettings({ retention, warnDays, autoIntervalHours: autoHours, backupDir: dir });
      setOpen(false); onSaved();
    } catch (e) { setErr(msg(e)); }
  }
  async function pickDir() {
    const r = await api.chooseBackupDir();
    if (!r.canceled) setDir(r.dir);
  }

  return (
    <>
      <button onClick={() => setOpen(true)}>Configurar</button>
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Configurações de backup</h2>
            <label>Pasta de backup</label>
            <div className="row">
              <input type="text" value={dir} onChange={(e) => setDir(e.target.value)} />
              <button onClick={pickDir}>Escolher…</button>
            </div>
            <label>Manter (rotação)</label>
            <input type="number" min="1" value={retention} onChange={(e) => setRetention(e.target.value)} />
            <label>Backup automático a cada (horas)</label>
            <input type="number" min="1" value={autoHours} onChange={(e) => setAutoHours(e.target.value)} />
            <label>Avisar se passar de (dias)</label>
            <input type="number" min="1" value={warnDays} onChange={(e) => setWarnDays(e.target.value)} />
            <div className="err">{err}</div>
            <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setOpen(false)}>Cancelar</button>
              <button className="primary" onClick={save}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function RestoreModal({ backup, onClose, onDone }) {
  const [pwd, setPwd] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function go() {
    setErr(''); setBusy(true);
    try { await api.restore(backup.folder, pwd); onDone(); }
    catch (e) { setErr(msg(e)); setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Restaurar backup</h2>
        <p className="sub">
          Restaurar <b>{fmtDate(backup.createdAt) || backup.name}</b>. O estado atual será salvo
          automaticamente como “pré-restauração” antes de substituir.
        </p>
        <label>Senha mestra de quando o backup foi feito</label>
        <input type="password" value={pwd} autoFocus onChange={(e) => setPwd(e.target.value)} />
        <div className="hint">Cada backup é autossuficiente: requer a senha que valia na época dele.</div>
        <div className="err">{err}</div>
        <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={onClose}>Cancelar</button>
          <button className="danger" disabled={busy} onClick={go}>{busy ? 'Restaurando…' : 'Restaurar'}</button>
        </div>
      </div>
    </div>
  );
}

function ChangePasswordModal({ onClose, onDone }) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function go() {
    setErr('');
    if (next.length < 8) return setErr(ERR.SENHA_CURTA);
    if (next !== confirm) return setErr('As senhas novas não conferem.');
    setBusy(true);
    try { await api.changePassword(cur, next); onDone(); }
    catch (e) { setErr(msg(e)); setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Trocar senha mestra</h2>
        <p className="sub">O banco será re-cifrado com a nova senha. Um backup de segurança é feito antes.</p>
        <label>Senha atual</label>
        <input type="password" value={cur} autoFocus onChange={(e) => setCur(e.target.value)} />
        <label>Nova senha</label>
        <input type="password" value={next} onChange={(e) => setNext(e.target.value)} />
        <label>Confirmar nova senha</label>
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <div className="err">{err}</div>
        <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={onClose}>Cancelar</button>
          <button className="primary" disabled={busy} onClick={go}>{busy ? 'Trocando…' : 'Trocar'}</button>
        </div>
      </div>
    </div>
  );
}

// ----- utils -----
function fmtDate(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString('pt-BR'); } catch { return iso; }
}
function fmtSize(n) {
  if (!n) return '—';
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
function labelReason(r) {
  return r === 'pre-restore' ? 'pré-restauração' : r === 'auto' ? 'automático' : 'manual';
}
