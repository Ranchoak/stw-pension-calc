// Sign-in + saved-scenario bar. Deliberately low-key: the calculator never
// needs an account — this exists only so returning users can skip re-typing.
// Renders three ways:
//   1. Supabase not configured → one muted line, nothing else.
//   2. Signed out → "no account needed" + optional magic-link email form.
//   3. Signed in → scenario picker, name field, save/delete, sign out.

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { listScenarios, saveScenario, deleteScenario } from '../lib/scenarios.js';

export default function AccountBar({ formPristine, currentInputs, onLoadInputs }) {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [linkSent, setLinkSent] = useState(false);
  const [open, setOpen] = useState(false);
  const [scenarios, setScenarios] = useState([]);
  const [name, setName] = useState('My plan');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  // formPristine is only consulted at the moment scenarios first load after
  // sign-in; keep the latest value in a ref so the effect below doesn't
  // re-run (and clobber typing) every keystroke.
  const pristineRef = useRef(formPristine);
  pristineRef.current = formPristine;

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Key this on the user ID, not the session object: Supabase hands us a new
  // session reference on every token refresh (hourly, and on tab focus), and
  // we don't want to reload scenarios / reset the name field each time — only
  // when the actual signed-in user changes.
  const userId = session?.user?.id ?? null;
  useEffect(() => {
    if (!supabase || !userId) { setScenarios([]); return; }
    let cancelled = false;
    listScenarios()
      .then((rows) => {
        if (cancelled) return;
        setScenarios(rows);
        if (rows.length > 0) {
          setName(rows[0].name);
          // Pre-fill with the most recent scenario — but never overwrite
          // something the user already started typing.
          if (pristineRef.current) onLoadInputs(rows[0].inputs);
        }
      })
      .catch((e) => { if (!cancelled) setMsg(e.message); });
    return () => { cancelled = true; };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!supabase) {
    return (
      <div className="account">
        <span className="account-muted">
          Scenario saving is off in this build (Supabase isn't configured — see
          README). The calculator works fully without it.
        </span>
      </div>
    );
  }

  const sendLink = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg('');
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setLinkSent(true);
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => setScenarios(await listScenarios());

  const save = async () => {
    setBusy(true); setMsg('');
    try {
      await saveScenario({ name: name.trim() || 'My plan', inputs: currentInputs });
      await refresh();
      setMsg('Saved.');
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  };

  const load = (id) => {
    const row = scenarios.find((s) => s.id === id);
    if (!row) return;
    setName(row.name);
    onLoadInputs(row.inputs);
    setMsg('');
  };

  const selected = scenarios.find((s) => s.name === name.trim());

  const del = async () => {
    if (!selected) return;
    setBusy(true); setMsg('');
    try {
      await deleteScenario(selected.id);
      await refresh();
      setMsg('Deleted.');
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setOpen(false); setLinkSent(false); setMsg('');
  };

  if (!session) {
    return (
      <div className="account">
        <span className="account-muted">No account needed — sign in only if you want your inputs saved for next time.</span>
        {!open ? (
          <button type="button" className="linklike" onClick={() => setOpen(true)}>Save my inputs</button>
        ) : linkSent ? (
          <span>Check your email — the sign-in link brings you right back here.</span>
        ) : (
          <form className="account-form" onSubmit={sendLink}>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email for sign-in link"
            />
            <button type="submit" className="btn small" disabled={busy}>Email me a sign-in link</button>
          </form>
        )}
        {msg && <span className="account-msg">{msg}</span>}
      </div>
    );
  }

  return (
    <div className="account">
      <span className="account-id">{session.user.email}</span>
      {scenarios.length > 0 && (
        <select
          value={selected ? selected.id : ''}
          onChange={(e) => load(e.target.value)}
          aria-label="Saved scenarios"
        >
          {!selected && <option value="">— scenarios —</option>}
          {scenarios.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      )}
      <input
        className="scenario-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label="Scenario name"
        title="Change the name to save a separate scenario (e.g. 'retire at 50')"
      />
      <button type="button" className="btn small" onClick={save} disabled={busy}>
        {selected ? 'Save' : 'Save as new'}
      </button>
      {selected && (
        <button type="button" className="linklike" onClick={del} disabled={busy}>Delete</button>
      )}
      <button type="button" className="linklike" onClick={signOut}>Sign out</button>
      {msg && <span className="account-msg">{msg}</span>}
    </div>
  );
}
