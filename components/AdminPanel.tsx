'use client';

import { useEffect, useState } from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { Activity, Database, FileText, KeyRound, LoaderCircle, RefreshCcw, Save, Server, Shield, Users } from 'lucide-react';
import { config } from '@/lib/config';
import { executeFunction } from '@/lib/functions';
import type {
  AdminAuditEvent,
  AdminCloudProject,
  AdminCredit,
  AdminDashboard,
  AdminLogEntry,
  AdminLogQueryResult,
  AdminModelPoolKey,
  AdminOperationRun,
  AdminSetting,
  AdminSupportTicket,
  AdminUsage,
  AdminUser,
  AdminUtilityModel,
} from '@/lib/types';
import { Banner } from '@/components/ui/Banner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FormField, TextArea, TextInput } from '@/components/ui/FormField';
import { PageHeader } from '@/components/ui/Section';

type AdminTab = 'overview' | 'users' | 'models' | 'database' | 'infra' | 'logs' | 'audit';

type UserDetail = {
  user: AdminUser;
  entitlement: { tier: string; status: string; monthlyCredits: number; notes?: string } | null;
  boards: Array<{ id: string; name: string; status: string; firmwareVersion: string }>;
  firmwares?: Array<{ id: string; boardId: string; version: string; filename: string; deployed: boolean; uploadedAt: string }>;
  usage: AdminUsage[];
  credits: AdminCredit[];
  projects?: AdminCloudProject[];
};

type DatabaseStatus = {
  collections: Array<{ id: string; name: string; total: number; status: string; error?: string }>;
  storage?: Array<{ id: string; name: string; total: number; status: string; error?: string }>;
  missing: string[];
};

type FunctionStatus = {
  functions: Array<{ id: string; name: string; status: string; statusCode?: number; duration?: number; error?: string; updatedAt?: string }>;
};

type InfraTarget = {
  key: string;
  label: string;
  configured: boolean;
  resourceGroup?: string;
  vmName?: string;
  size?: string;
  powerState?: string;
  publicIp?: string;
  health?: { ok: boolean; message: string };
  backup?: { ok: boolean; message: string; ageHours?: number };
  metrics?: Record<string, number | string>;
  recommendedMode?: string;
  error?: string;
};

type InfraStatus = {
  targets: InfraTarget[];
  operations: AdminOperationRun[];
};

type LogSource = {
  id: string;
  label: string;
  supportsTail: boolean;
  supportsExport: boolean;
};

type ManagedForm = {
  keyId: string;
  providerLabel: string;
  baseUrl: string;
  apiKey: string;
  status: string;
  fastModel: string;
  fastEditorModel: string;
  powerModel: string;
  powerEditorModel: string;
  assignmentWeight: string;
  maxAssignments: string;
};

type UtilityForm = {
  keyId: string;
  providerLabel: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  enabled: boolean;
  taskTags: string;
  priority: string;
};

function time(value?: string | null) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString();
}

function statusVariant(status?: string) {
  const clean = String(status || '').toLowerCase();
  if (['ok', 'pass', 'active', 'success', 'completed', 'running', 'succeeded'].includes(clean)) return 'success';
  if (['failed', 'fail', 'error', 'blocked', 'disabled'].includes(clean)) return 'danger';
  if (['pending', 'warning', 'paused', 'inprogress', 'starting'].includes(clean)) return 'warning';
  return 'default';
}

const tabs: Array<{ id: AdminTab; label: string; icon: ReactNode }> = [
  { id: 'overview', label: 'Overview', icon: <Activity size={14} /> },
  { id: 'users', label: 'Users', icon: <Users size={14} /> },
  { id: 'models', label: 'AI Pools', icon: <KeyRound size={14} /> },
  { id: 'database', label: 'Database', icon: <Database size={14} /> },
  { id: 'infra', label: 'Infra', icon: <Server size={14} /> },
  { id: 'logs', label: 'Logs', icon: <FileText size={14} /> },
  { id: 'audit', label: 'Audit', icon: <Shield size={14} /> },
];

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selected, setSelected] = useState<UserDetail | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState('');
  const [search, setSearch] = useState('');
  const [setting, setSetting] = useState({ key: 'agent.outputStyle', value: 'compact', description: 'Agent response style.' });
  const [entitlement, setEntitlement] = useState({ tier: 'hobby', status: 'active', monthlyCredits: '500', notes: '' });
  const [modelPool, setModelPool] = useState<AdminModelPoolKey[]>([]);
  const [utilityPool, setUtilityPool] = useState<AdminUtilityModel[]>([]);
  const [managedForm, setManagedForm] = useState({
    keyId: '',
    providerLabel: 'Azure AI Foundry',
    baseUrl: '',
    apiKey: '',
    status: 'active',
    fastModel: 'gpt-4.1',
    fastEditorModel: 'gpt-4.1',
    powerModel: 'gpt-5.5',
    powerEditorModel: 'gpt-4.1',
    assignmentWeight: '1',
    maxAssignments: '0',
  });
  const [utilityForm, setUtilityForm] = useState({
    keyId: '',
    providerLabel: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4.1-mini',
    enabled: true,
    taskTags: 'board-detection',
    priority: '100',
  });
  const [databaseStatus, setDatabaseStatus] = useState<DatabaseStatus | null>(null);
  const [functionStatus, setFunctionStatus] = useState<FunctionStatus | null>(null);
  const [infraStatus, setInfraStatus] = useState<InfraStatus | null>(null);
  const [resizeForm, setResizeForm] = useState({ target: 'appwrite', size: 'Standard_B2s_v2', confirmation: '' });
  const [logSources, setLogSources] = useState<LogSource[]>([]);
  const [logQuery, setLogQuery] = useState({ source: 'appwrite-functions', range: 'PT1H', service: '', severity: '', search: '', limit: '100' });
  const [logs, setLogs] = useState<AdminLogEntry[]>([]);
  const [logExport, setLogExport] = useState('');
  const [audit, setAudit] = useState<AdminAuditEvent[]>([]);

  async function run<T>(label: string, path: string, payload: Record<string, unknown> = {}) {
    setBusy(label);
    setStatus('');
    try {
      return await executeFunction<T>(config.webAdminFunctionId, path, payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : `${label} failed.`;
      setStatus(message);
      throw error;
    } finally {
      setBusy('');
    }
  }

  async function load() {
    const data = await run<AdminDashboard>('dashboard', '/dashboard');
    setDashboard(data);
    setUsers(data.recentUsers);
  }

  async function loadModels() {
    const [managed, utility] = await Promise.all([
      run<{ keys: AdminModelPoolKey[] }>('models', '/model-pool'),
      run<{ models: AdminUtilityModel[] }>('utility-models', '/utility-model-pool'),
    ]);
    setModelPool(managed.keys);
    setUtilityPool(utility.models);
  }

  async function loadDatabaseStatus() {
    const [database, functions] = await Promise.all([
      run<DatabaseStatus>('database', '/database/status'),
      run<FunctionStatus>('functions', '/functions/status'),
    ]);
    setDatabaseStatus(database);
    setFunctionStatus(functions);
  }

  async function loadInfra() {
    setInfraStatus(await run<InfraStatus>('infra', '/infra/status'));
  }

  async function loadLogSources() {
    const data = await run<{ sources: LogSource[] }>('log-sources', '/logs/sources');
    setLogSources(data.sources);
    if (data.sources.length && !data.sources.some((source) => source.id === logQuery.source)) {
      setLogQuery((current) => ({ ...current, source: data.sources[0].id }));
    }
  }

  async function queryLogs(exportLogs = false) {
    const path = exportLogs ? '/logs/export' : '/logs/query';
    const data = await run<AdminLogQueryResult>(exportLogs ? 'logs-export' : 'logs', path, {
      ...logQuery,
      limit: Number(logQuery.limit || 100),
    });
    setLogs(data.entries || []);
    setLogExport(data.exportedText || '');
  }

  async function tailLogs() {
    const data = await run<AdminLogQueryResult>('logs-tail', '/logs/tail', {
      ...logQuery,
      limit: Number(logQuery.limit || 100),
    });
    setLogs(data.entries || []);
  }

  async function loadAudit() {
    const data = await run<{ events: AdminAuditEvent[] }>('audit', '/audit/list', { limit: 100 });
    setAudit(data.events);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (activeTab === 'models') void loadModels();
    if (activeTab === 'database') void loadDatabaseStatus();
    if (activeTab === 'infra') void loadInfra();
    if (activeTab === 'logs') void loadLogSources();
    if (activeTab === 'audit') void loadAudit();
  }, [activeTab]);

  async function findUsers() {
    const data = await run<{ users: AdminUser[] }>('users', '/users', { search, limit: 50 });
    setUsers(data.users);
  }

  async function openUser(userId: string) {
    const data = await run<UserDetail>('user-detail', '/users/detail', { userId });
    setSelected(data);
    setEntitlement({
      tier: data.entitlement?.tier || 'hobby',
      status: data.entitlement?.status || 'active',
      monthlyCredits: String(data.entitlement?.monthlyCredits || 500),
      notes: data.entitlement?.notes || '',
    });
  }

  async function saveEntitlement() {
    if (!selected) return;
    await run('entitlement', '/users/entitlement', {
      userId: selected.user.id,
      tier: entitlement.tier,
      status: entitlement.status,
      monthlyCredits: Number(entitlement.monthlyCredits || 0),
      notes: entitlement.notes,
    });
    setStatus('Entitlement updated.');
    await openUser(selected.user.id);
  }

  async function saveSetting() {
    await run('setting', '/settings/upsert', setting);
    setStatus('Setting updated.');
    await load();
  }

  async function saveManagedPool() {
    const data = await run<{ key: AdminModelPoolKey }>('managed-pool', '/model-pool/upsert', {
      ...managedForm,
      assignmentWeight: Number(managedForm.assignmentWeight || 1),
      maxAssignments: Number(managedForm.maxAssignments || 0),
    });
    setStatus('Managed pool entry saved.');
    setManagedForm((current) => ({ ...current, keyId: data.key.id, apiKey: '' }));
    await loadModels();
  }

  async function saveUtilityPool() {
    const data = await run<{ model: AdminUtilityModel }>('utility-pool', '/utility-model-pool/upsert', {
      ...utilityForm,
      priority: Number(utilityForm.priority || 100),
    });
    setStatus('Utility AI pool entry saved.');
    setUtilityForm((current) => ({ ...current, keyId: data.model.id, apiKey: '' }));
    await loadModels();
  }

  async function testPool(path: string, payload: Record<string, unknown>) {
    await run('pool-test', path, payload);
    setStatus('Model pool health test passed.');
    await loadModels();
  }

  async function preflightResize() {
    const data = await run<{ target: InfraTarget; preflight: Record<string, unknown>; confirmation: string }>('resize-preflight', '/infra/preflight', resizeForm);
    setResizeForm((current) => ({ ...current, confirmation: data.confirmation }));
    setStatus(`Preflight complete. Confirmation phrase inserted for ${data.target.label}.`);
  }

  async function startResize() {
    const data = await run<{ operation: AdminOperationRun }>('resize', '/infra/resize', resizeForm);
    setStatus(`Resize operation started: ${data.operation.id}`);
    await loadInfra();
  }

  async function pollOperation(operationId: string) {
    const data = await run<{ operation: AdminOperationRun }>('operation', '/infra/operation', { operationId });
    setStatus(`Operation ${data.operation.id}: ${data.operation.status}`);
    await loadInfra();
  }

  const dashboardTotals = dashboard?.totals;

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Operations panel"
        actions={
          <Button variant="secondary" type="button" onClick={() => void load()}>
            {busy ? <LoaderCircle size={14} className="spin" /> : <RefreshCcw size={14} />} Refresh
          </Button>
        }
      />
      {status ? <Banner variant={status.toLowerCase().includes('failed') || status.toLowerCase().includes('unable') ? 'error' : 'info'}>{status}</Banner> : null}
      <div className="admin-tabs">
        {tabs.map((tab) => (
          <button key={tab.id} className={activeTab === tab.id ? 'active' : ''} type="button" onClick={() => setActiveTab(tab.id)}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' ? (
        <>
          <div className="metric-grid">
            <Metric label="Users" value={dashboardTotals?.users} />
            <Metric label="Boards" value={dashboardTotals?.boards} />
            <Metric label="Projects" value={dashboardTotals?.projects} />
            <Metric label="Credits charged" value={dashboardTotals?.chargedCredits} />
          </div>
          <div className="section-grid">
            <SummaryTable title="Recent usage" headers={['User', 'Mode', 'Status', 'Credits']} rows={(dashboard?.recentUsage || []).slice(0, 8).map((entry) => [entry.userId, `${entry.source}/${entry.mode}`, entry.status, String(entry.chargedCredits)])} />
            <SummaryTable title="Recent tickets" headers={['Subject', 'Status', 'Priority']} rows={(dashboard?.supportTickets || []).slice(0, 8).map((entry) => [entry.subject, entry.status, entry.priority])} />
            <SummaryTable title="Settings" headers={['Key', 'Updated']} rows={(dashboard?.settings || []).slice(0, 8).map((entry) => [entry.key, time(entry.updatedAt)])} />
          </div>
          <section className="settings-card" style={{ marginTop: 20 }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Global setting</h2>
            <div className="section-grid">
              <FormField label="Key"><TextInput value={setting.key} onChange={(event) => setSetting((current) => ({ ...current, key: event.target.value }))} /></FormField>
              <FormField label="Value"><TextInput value={setting.value} onChange={(event) => setSetting((current) => ({ ...current, value: event.target.value }))} /></FormField>
              <FormField label="Description"><TextInput value={setting.description} onChange={(event) => setSetting((current) => ({ ...current, description: event.target.value }))} /></FormField>
            </div>
            <div className="hero-actions"><Button variant="primary" type="button" onClick={() => void saveSetting()}><Save size={14} /> Save setting</Button></div>
          </section>
        </>
      ) : null}

      {activeTab === 'users' ? (
        <UsersAdmin
          users={users}
          selected={selected}
          search={search}
          entitlement={entitlement}
          setSearch={setSearch}
          setEntitlement={setEntitlement}
          findUsers={findUsers}
          openUser={openUser}
          saveEntitlement={saveEntitlement}
        />
      ) : null}

      {activeTab === 'models' ? (
        <ModelsAdmin
          managed={modelPool}
          utility={utilityPool}
          managedForm={managedForm}
          utilityForm={utilityForm}
          setManagedForm={setManagedForm}
          setUtilityForm={setUtilityForm}
          saveManagedPool={saveManagedPool}
          saveUtilityPool={saveUtilityPool}
          testPool={testPool}
        />
      ) : null}

      {activeTab === 'database' ? <DatabaseAdmin databaseStatus={databaseStatus} functionStatus={functionStatus} refresh={loadDatabaseStatus} /> : null}

      {activeTab === 'infra' ? (
        <InfraAdmin
          infra={infraStatus}
          form={resizeForm}
          setForm={setResizeForm}
          refresh={loadInfra}
          preflight={preflightResize}
          resize={startResize}
          pollOperation={pollOperation}
        />
      ) : null}

      {activeTab === 'logs' ? (
        <LogsAdmin
          sources={logSources}
          query={logQuery}
          setQuery={setLogQuery}
          logs={logs}
          exportedText={logExport}
          queryLogs={queryLogs}
          tailLogs={tailLogs}
        />
      ) : null}

      {activeTab === 'audit' ? <AuditAdmin events={audit} refresh={loadAudit} /> : null}
    </>
  );
}

function Metric({ label, value }: { label: string; value?: number | string }) {
  return <div className="metric"><span>{label}</span><strong>{value ?? '-'}</strong></div>;
}

function SummaryTable({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) {
  return (
    <section className="settings-card">
      <h2 style={{ margin: 0, fontSize: 16 }}>{title}</h2>
      <div className="table-wrap">
        <table className="table">
          <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
          <tbody>
            {rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}
            {rows.length === 0 ? <tr><td colSpan={headers.length}>No data yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UsersAdmin(props: {
  users: AdminUser[];
  selected: UserDetail | null;
  search: string;
  entitlement: { tier: string; status: string; monthlyCredits: string; notes: string };
  setSearch: (value: string) => void;
  setEntitlement: Dispatch<SetStateAction<{ tier: string; status: string; monthlyCredits: string; notes: string }>>;
  findUsers: () => Promise<void>;
  openUser: (userId: string) => Promise<void>;
  saveEntitlement: () => Promise<void>;
}) {
  return (
    <>
      <section className="settings-card">
        <h2 style={{ margin: 0, fontSize: 16 }}>Users</h2>
        <div className="hero-actions">
          <TextInput style={{ maxWidth: 340 }} value={props.search} onChange={(event) => props.setSearch(event.target.value)} placeholder="Search by email or name" />
          <Button variant="secondary" type="button" onClick={() => void props.findUsers()}>Search</Button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>User</th><th>Email</th><th>Labels</th><th>Status</th><th>Last active</th></tr></thead>
            <tbody>
              {props.users.map((user) => (
                <tr key={user.id}>
                  <td><Button variant="ghost" size="sm" type="button" onClick={() => void props.openUser(user.id)}>{user.name || user.id}</Button></td>
                  <td>{user.email}</td>
                  <td><code>{user.labels.join(', ') || '-'}</code></td>
                  <td><Badge variant={statusVariant(user.status ? 'active' : 'disabled')}>{user.status ? 'active' : 'disabled'}</Badge></td>
                  <td>{time(user.accessedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {props.selected ? (
        <section className="settings-card" style={{ marginTop: 20 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>{props.selected.user.email}</h2>
          <div className="metric-grid">
            <Metric label="Boards" value={props.selected.boards.length} />
            <Metric label="Projects" value={props.selected.projects?.length || 0} />
            <Metric label="Usage events" value={props.selected.usage.length} />
            <Metric label="Credit periods" value={props.selected.credits.length} />
          </div>
          <div className="section-grid">
            <FormField label="Tier">
              <select value={props.entitlement.tier} onChange={(event) => props.setEntitlement((current) => ({ ...current, tier: event.target.value }))}>
                <option value="hobby">Hobby</option>
                <option value="pro">Pro</option>
                <option value="max">Max</option>
              </select>
            </FormField>
            <FormField label="Status">
              <select value={props.entitlement.status} onChange={(event) => props.setEntitlement((current) => ({ ...current, status: event.target.value }))}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="blocked">Blocked</option>
              </select>
            </FormField>
            <FormField label="Monthly credits">
              <TextInput value={props.entitlement.monthlyCredits} onChange={(event) => props.setEntitlement((current) => ({ ...current, monthlyCredits: event.target.value }))} />
            </FormField>
          </div>
          <FormField label="Notes">
            <TextArea rows={3} value={props.entitlement.notes} onChange={(event) => props.setEntitlement((current) => ({ ...current, notes: event.target.value }))} />
          </FormField>
          <div className="hero-actions"><Button variant="primary" type="button" onClick={() => void props.saveEntitlement()}>Update user</Button></div>
          <SummaryTable title="Boards" headers={['Name', 'Status', 'Firmware']} rows={props.selected.boards.map((board) => [board.name, board.status, board.firmwareVersion])} />
          <SummaryTable title="Usage" headers={['Mode', 'Status', 'Credits', 'Created']} rows={props.selected.usage.slice(0, 12).map((entry) => [entry.mode, entry.status, String(entry.chargedCredits), time(entry.createdAt)])} />
        </section>
      ) : null}
    </>
  );
}

function ModelsAdmin(props: {
  managed: AdminModelPoolKey[];
  utility: AdminUtilityModel[];
  managedForm: ManagedForm;
  utilityForm: UtilityForm;
  setManagedForm: Dispatch<SetStateAction<ManagedForm>>;
  setUtilityForm: Dispatch<SetStateAction<UtilityForm>>;
  saveManagedPool: () => Promise<void>;
  saveUtilityPool: () => Promise<void>;
  testPool: (path: string, payload: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <div className="admin-two-col">
      <section className="settings-card">
        <h2 style={{ margin: 0, fontSize: 16 }}>Managed agent pool</h2>
        <div className="section-grid">
          <FormField label="Provider"><TextInput value={props.managedForm.providerLabel} onChange={(event) => props.setManagedForm((current) => ({ ...current, providerLabel: event.target.value }))} /></FormField>
          <FormField label="Base URL"><TextInput value={props.managedForm.baseUrl} onChange={(event) => props.setManagedForm((current) => ({ ...current, baseUrl: event.target.value }))} /></FormField>
          <FormField label="Status">
            <select value={props.managedForm.status} onChange={(event) => props.setManagedForm((current) => ({ ...current, status: event.target.value }))}>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </FormField>
          <FormField label="Fast model"><TextInput value={props.managedForm.fastModel} onChange={(event) => props.setManagedForm((current) => ({ ...current, fastModel: event.target.value }))} /></FormField>
          <FormField label="Power model"><TextInput value={props.managedForm.powerModel} onChange={(event) => props.setManagedForm((current) => ({ ...current, powerModel: event.target.value }))} /></FormField>
          <FormField label="API key"><TextInput type="password" value={props.managedForm.apiKey} onChange={(event) => props.setManagedForm((current) => ({ ...current, apiKey: event.target.value }))} /></FormField>
        </div>
        <div className="hero-actions"><Button variant="primary" type="button" onClick={() => void props.saveManagedPool()}><Save size={14} /> Save managed key</Button></div>
        <PoolTable
          rows={props.managed.map((entry) => ({
            id: entry.id,
            title: entry.providerLabel,
            subtitle: `${entry.fastModel} / ${entry.powerModel}`,
            status: entry.status,
            preview: entry.apiKeyPreview,
            onEdit: () => props.setManagedForm((current) => ({ ...current, ...entry, keyId: entry.id, assignmentWeight: String(entry.assignmentWeight), maxAssignments: String(entry.maxAssignments), apiKey: '' })),
            onTest: () => props.testPool('/model-pool/test', { keyId: entry.id }),
          }))}
        />
      </section>
      <section className="settings-card">
        <h2 style={{ margin: 0, fontSize: 16 }}>Utility AI pool</h2>
        <div className="section-grid">
          <FormField label="Provider"><TextInput value={props.utilityForm.providerLabel} onChange={(event) => props.setUtilityForm((current) => ({ ...current, providerLabel: event.target.value }))} /></FormField>
          <FormField label="Base URL"><TextInput value={props.utilityForm.baseUrl} onChange={(event) => props.setUtilityForm((current) => ({ ...current, baseUrl: event.target.value }))} /></FormField>
          <FormField label="Model"><TextInput value={props.utilityForm.model} onChange={(event) => props.setUtilityForm((current) => ({ ...current, model: event.target.value }))} /></FormField>
          <FormField label="Task tags"><TextInput value={props.utilityForm.taskTags} onChange={(event) => props.setUtilityForm((current) => ({ ...current, taskTags: event.target.value }))} /></FormField>
          <FormField label="Priority"><TextInput value={props.utilityForm.priority} onChange={(event) => props.setUtilityForm((current) => ({ ...current, priority: event.target.value }))} /></FormField>
          <FormField label="API key"><TextInput type="password" value={props.utilityForm.apiKey} onChange={(event) => props.setUtilityForm((current) => ({ ...current, apiKey: event.target.value }))} /></FormField>
        </div>
        <div className="hero-actions"><Button variant="primary" type="button" onClick={() => void props.saveUtilityPool()}><Save size={14} /> Save utility model</Button></div>
        <PoolTable
          rows={props.utility.map((entry) => ({
            id: entry.id,
            title: entry.providerLabel,
            subtitle: `${entry.model} • ${entry.taskTags.join(', ') || 'all tasks'}`,
            status: entry.enabled ? 'active' : 'disabled',
            preview: entry.apiKeyPreview,
            onEdit: () => props.setUtilityForm((current) => ({ ...current, ...entry, keyId: entry.id, enabled: entry.enabled, taskTags: entry.taskTags.join(', '), priority: String(entry.priority), apiKey: '' })),
            onTest: () => props.testPool('/utility-model-pool/test', { keyId: entry.id }),
          }))}
        />
      </section>
    </div>
  );
}

function PoolTable({ rows }: { rows: Array<{ id: string; title: string; subtitle: string; status: string; preview: string; onEdit: () => void; onTest: () => void }> }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.title}<br /><span className="muted">{row.subtitle}</span></td>
              <td><Badge variant={statusVariant(row.status)}>{row.status}</Badge></td>
              <td>{row.preview || '-'}</td>
              <td><div className="row-actions"><Button variant="secondary" type="button" onClick={row.onEdit}>Edit</Button><Button variant="secondary" type="button" onClick={row.onTest}>Test</Button></div></td>
            </tr>
          ))}
          {rows.length === 0 ? <tr><td>No model pool entries yet.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

function DatabaseAdmin({ databaseStatus, functionStatus, refresh }: { databaseStatus: DatabaseStatus | null; functionStatus: FunctionStatus | null; refresh: () => Promise<void> }) {
  return (
    <>
      <div className="hero-actions"><Button variant="secondary" type="button" onClick={() => void refresh()}><RefreshCcw size={14} /> Refresh checks</Button></div>
      {databaseStatus?.missing.length ? <Banner variant="warning">Missing configuration: {databaseStatus.missing.join(', ')}</Banner> : null}
      <SummaryTable title="Collections" headers={['ID', 'Status', 'Rows']} rows={(databaseStatus?.collections || []).map((entry) => [entry.id, entry.error || entry.status, String(entry.total)])} />
      <SummaryTable title="Buckets" headers={['ID', 'Status', 'Files']} rows={(databaseStatus?.storage || []).map((entry) => [entry.id, entry.error || entry.status, String(entry.total)])} />
      <SummaryTable title="Functions" headers={['ID', 'Status', 'Code', 'Duration']} rows={(functionStatus?.functions || []).map((entry) => [entry.id, entry.error || entry.status, String(entry.statusCode || '-'), `${entry.duration || 0}ms`])} />
    </>
  );
}

function InfraAdmin(props: {
  infra: InfraStatus | null;
  form: { target: string; size: string; confirmation: string };
  setForm: Dispatch<SetStateAction<{ target: string; size: string; confirmation: string }>>;
  refresh: () => Promise<void>;
  preflight: () => Promise<void>;
  resize: () => Promise<void>;
  pollOperation: (operationId: string) => Promise<void>;
}) {
  return (
    <>
      <section className="settings-card">
        <div className="panel-heading-row">
          <h2 style={{ margin: 0, fontSize: 16 }}>Azure VPS scaling</h2>
          <Button variant="secondary" type="button" onClick={() => void props.refresh()}><RefreshCcw size={14} /> Refresh</Button>
        </div>
        <div className="section-grid">
          <FormField label="Target">
            <select value={props.form.target} onChange={(event) => props.setForm((current) => ({ ...current, target: event.target.value }))}>
              <option value="appwrite">Appwrite VM</option>
              <option value="gitea">Gitea VM</option>
            </select>
          </FormField>
          <FormField label="Target size">
            <TextInput value={props.form.size} onChange={(event) => props.setForm((current) => ({ ...current, size: event.target.value }))} />
          </FormField>
          <FormField label="Confirmation">
            <TextInput value={props.form.confirmation} onChange={(event) => props.setForm((current) => ({ ...current, confirmation: event.target.value }))} />
          </FormField>
        </div>
        <div className="hero-actions">
          <Button variant="secondary" type="button" onClick={() => void props.preflight()}>Run preflight</Button>
          <Button variant="primary" type="button" onClick={() => void props.resize()}>Start guarded resize</Button>
        </div>
      </section>
      <div className="section-grid">
        {(props.infra?.targets || []).map((target) => (
          <section key={target.key} className="settings-card">
            <h2 style={{ margin: 0, fontSize: 16 }}>{target.label}</h2>
            <p className="muted">{target.resourceGroup} / {target.vmName}</p>
            <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              <Metric label="Size" value={target.size || '-'} />
              <Metric label="Power" value={target.powerState || '-'} />
              <Metric label="IP" value={target.publicIp || '-'} />
              <Metric label="Recommended" value={target.recommendedMode || '-'} />
            </div>
            {target.health ? <Badge variant={target.health.ok ? 'success' : 'danger'}>{target.health.message}</Badge> : null}
            {target.backup ? <Badge variant={target.backup.ok ? 'success' : 'danger'}>{target.backup.message}</Badge> : null}
            {target.error ? <Banner variant="error">{target.error}</Banner> : null}
          </section>
        ))}
      </div>
      <SummaryTable
        title="Operations"
        headers={['ID', 'Operation', 'Target', 'Status', 'Updated']}
        rows={(props.infra?.operations || []).map((operation) => [operation.id, operation.operation, operation.target, operation.status, time(operation.updatedAt)])}
      />
      <div className="row-actions">
        {(props.infra?.operations || []).filter((operation) => !['completed', 'failed'].includes(operation.status)).map((operation) => (
          <Button key={operation.id} variant="secondary" type="button" onClick={() => void props.pollOperation(operation.id)}>Poll {operation.id}</Button>
        ))}
      </div>
    </>
  );
}

function LogsAdmin(props: {
  sources: LogSource[];
  query: { source: string; range: string; service: string; severity: string; search: string; limit: string };
  setQuery: Dispatch<SetStateAction<{ source: string; range: string; service: string; severity: string; search: string; limit: string }>>;
  logs: AdminLogEntry[];
  exportedText: string;
  queryLogs: (exportLogs?: boolean) => Promise<void>;
  tailLogs: () => Promise<void>;
}) {
  const selectedSource = props.sources.find((source) => source.id === props.query.source);
  return (
    <>
      <section className="settings-card">
        <h2 style={{ margin: 0, fontSize: 16 }}>Server and Appwrite logs</h2>
        <div className="section-grid">
          <FormField label="Source">
            <select value={props.query.source} onChange={(event) => props.setQuery((current) => ({ ...current, source: event.target.value }))}>
              {props.sources.map((source) => <option key={source.id} value={source.id}>{source.label}</option>)}
            </select>
          </FormField>
          <FormField label="Time range">
            <select value={props.query.range} onChange={(event) => props.setQuery((current) => ({ ...current, range: event.target.value }))}>
              <option value="PT15M">15 minutes</option>
              <option value="PT1H">1 hour</option>
              <option value="PT6H">6 hours</option>
              <option value="P1D">24 hours</option>
              <option value="P7D">7 days</option>
            </select>
          </FormField>
          <FormField label="Limit">
            <TextInput value={props.query.limit} onChange={(event) => props.setQuery((current) => ({ ...current, limit: event.target.value }))} />
          </FormField>
          <FormField label="Service/container">
            <TextInput value={props.query.service} onChange={(event) => props.setQuery((current) => ({ ...current, service: event.target.value }))} />
          </FormField>
          <FormField label="Severity/status">
            <TextInput value={props.query.severity} onChange={(event) => props.setQuery((current) => ({ ...current, severity: event.target.value }))} />
          </FormField>
          <FormField label="Search">
            <TextInput value={props.query.search} onChange={(event) => props.setQuery((current) => ({ ...current, search: event.target.value }))} />
          </FormField>
        </div>
        <div className="hero-actions">
          <Button variant="primary" type="button" onClick={() => void props.queryLogs(false)}><FileText size={14} /> Query</Button>
          <Button variant="secondary" type="button" onClick={() => void props.tailLogs()} disabled={!selectedSource?.supportsTail}>Live tail</Button>
          <Button variant="secondary" type="button" onClick={() => void props.queryLogs(true)} disabled={!selectedSource?.supportsExport}>Export</Button>
        </div>
      </section>
      {props.exportedText ? (
        <section className="settings-card" style={{ marginTop: 20 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Export</h2>
          <TextArea rows={8} readOnly value={props.exportedText} />
        </section>
      ) : null}
      <div className="table-wrap" style={{ marginTop: 20 }}>
        <table className="table">
          <thead><tr><th>Time</th><th>Source</th><th>Service</th><th>Severity</th><th>Message</th></tr></thead>
          <tbody>
            {props.logs.map((entry) => (
              <tr key={entry.id}>
                <td>{time(entry.timestamp)}</td>
                <td>{entry.source}</td>
                <td>{entry.service}</td>
                <td><Badge variant={statusVariant(entry.severity || entry.status)}>{entry.severity || entry.status || '-'}</Badge></td>
                <td><code className="log-line">{entry.message}</code></td>
              </tr>
            ))}
            {props.logs.length === 0 ? <tr><td colSpan={5}>No logs loaded.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}

function AuditAdmin({ events, refresh }: { events: AdminAuditEvent[]; refresh: () => Promise<void> }) {
  return (
    <>
      <div className="hero-actions"><Button variant="secondary" type="button" onClick={() => void refresh()}><RefreshCcw size={14} /> Refresh audit</Button></div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th>Status</th><th>Message</th></tr></thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>{time(event.createdAt)}</td>
                <td><code>{event.actorUserId}</code></td>
                <td>{event.action}</td>
                <td>{event.target}</td>
                <td><Badge variant={statusVariant(event.status)}>{event.status}</Badge></td>
                <td>{event.message}</td>
              </tr>
            ))}
            {events.length === 0 ? <tr><td colSpan={6}>No audit events yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
