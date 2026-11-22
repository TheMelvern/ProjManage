import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { isAxiosError } from 'axios';
import api from '../../../api/axiosConfig';
import { PremiumComposeDialog } from '../../../components/PremiumComposeDialog';
import { SmartSelect } from '../../../components/SmartSelect';
import './UserAdmin.css';

interface Member {
  userId: string;
  membershipId: string;
  name: string;
  email: string;
  role: string;
}

const roleLabels: Partial<Record<string, string>> = {
  MEMBER: 'Member', PROJECT_MANAGER: 'Project manager', PMO: 'PMO', ADMIN: 'Administrator',
};
const roleOptions = Object.entries(roleLabels).map(([value, label]) => ({ value, label: label ?? value }));

function roleLabel(role: string) {
  return roleLabels[role] ?? role;
}

function initials(name: string) {
  return (name?.trim() || '?').split(/\s+/).slice(0, 2).map(word => word.charAt(0).toUpperCase()).join('');
}

function describe(failure: unknown) {
  const message = isAxiosError<{ message?: string | string[] }>(failure) ? failure.response?.data?.message : undefined;
  return (Array.isArray(message) ? message.join(', ') : message) ||
    (failure instanceof Error ? failure.message : 'Request failed');
}

export function UserAdmin() {
  const [people, setPeople] = useState<Member[] | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<Member | null>(null);
  const [proposedRole, setProposedRole] = useState('');
  const [roleReason, setRoleReason] = useState('');
  const activeLoad = useRef<AbortController | null>(null);
  const submitting = useRef(false);
  const query = search.trim().toLowerCase();
  const visible = people?.filter(person => (person.name + ' ' + person.email).toLowerCase().includes(query)) ?? [];

  const load = useCallback(async () => {
    activeLoad.current?.abort();
    const controller = new AbortController();
    activeLoad.current = controller;
    const { signal } = controller;
    setLoading(true);
    setError('');
    try {
      const response = await api.get<{ data: Member[] }>('/admin/users', { signal });
      if (!signal.aborted) setPeople(response.data.data);
    } catch (failure) {
      if (!signal.aborted) setError(describe(failure));
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => activeLoad.current?.abort();
  }, [load]);

  function edit(person: Member) {
    setEditing(person);
    setProposedRole(person.role);
    setRoleReason('');
    setError('');
  }

  function close() {
    if (!submitting.current) setEditing(null);
  }

  async function propose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = roleReason.trim();
    if (!editing || submitting.current || editing.role === proposedRole || reason.length < 5) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.post('/admin/users/proposals', { membershipId: editing.membershipId, role: proposedRole, reason });
      setEditing(null);
      setNotice('Role change submitted. A different administrator must approve it.');
      await load();
    } catch (failure) {
      setError(describe(failure));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="users-screen operational-page">
      <header className="page-head operational-heading"><div><h1>Users &amp; Roles</h1><p>Manage organization memberships with independent role-change approval.</p></div></header>
      {error && <p className="alert error" role="alert">{error}</p>}
      {notice && <p className="alert" role="status">{notice}</p>}
      <section className="card">
        <div className="card-heading"><div><h2>Membership directory</h2><p>Search by name or email. Role changes require a second administrator.</p></div>
          <button type="button" className="pmo-control quiet" onClick={load}>Refresh</button></div>
        <label className="search-label" htmlFor="user-search">Search members</label>
        <input id="user-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name or work email" />
        {loading ? <p role="status">Loading team members{'\u2026'}</p> : error && !people
          ? <p>Use Refresh to try loading the directory again.</p> : (
            <div className="scroll" tabIndex={0} role="region" aria-label="Membership directory table">
              <table>
                <thead><tr>{['Person', 'Work email', 'Current role', 'Action'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
                <tbody>{visible.map(person => <tr key={person.userId}>
                  <td><span className="person"><span className="avatar">{initials(person.name)}</span><strong>{person.name}</strong></span></td>
                  <td>{person.email}</td><td><span className="role">{roleLabel(person.role)}</span></td>
                  <td><button type="button" className="pmo-control quiet" aria-label={'Change role for ' + person.name} onClick={() => edit(person)}>Change role</button></td>
                </tr>)}
                  {visible.length === 0 && <tr><td colSpan={4}>No matching members.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
      </section>
      {editing && <PremiumComposeDialog open title="Propose a role change" description={editing.name} error={error} onClose={close}
        footer={<>
          <button type="button" className="pmo-control quiet" disabled={busy} onClick={close}>Cancel</button>
          <button type="submit" form="role-change-form" className="pmo-control primary"
            disabled={busy || editing.role === proposedRole || roleReason.trim().length < 5}>{busy ? 'Submitting\u2026' : 'Submit for review'}</button>
        </>}>
        <form id="role-change-form" onSubmit={propose}>
          <p>Current role: <strong>{roleLabel(editing.role)}</strong></p>
          <label>Proposed role <SmartSelect modelValue={proposedRole} ariaLabel="Proposed role" options={roleOptions} onChange={value => setProposedRole(String(value))} /></label>
          <label>Reason for change <textarea value={roleReason} onChange={event => setRoleReason(event.target.value)} required minLength={5} maxLength={300} rows={3} /></label>
        </form>
      </PremiumComposeDialog>}
    <details className="card role-matrix">
      <summary>Role permission matrix</summary><p>Enforced by the API; the frontend does not grant access by itself.</p>
      <div className="scroll" tabIndex={0} role="region" aria-label="Role permission matrix"><table><thead><tr><th>Capability</th><th>Administrator</th><th>PMO</th><th>Project manager</th><th>Member</th></tr></thead>
      <tbody><tr><td>Manage organization parameters and users</td><td>Yes</td><td>No</td><td>No</td><td>No</td></tr>
      <tr><td>Submit delivery & RAID changes</td><td>Yes</td><td>Yes</td><td>Yes</td><td>No</td></tr>
      <tr><td>Review project & leave changes</td><td>Yes</td><td>Yes</td><td>Yes</td><td>No</td></tr>
      <tr><td>Submit own timesheets and leave</td><td>Yes</td><td>Yes</td><td>Yes</td><td>Yes</td></tr>
      <tr><td>Approve user registrations and role changes</td><td>Yes</td><td>No</td><td>No</td><td>No</td></tr></tbody></table></div>
    </details>
    </main>
  );
}
