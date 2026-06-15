'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  KeyRound,
  LoaderCircle,
  Plus,
  RefreshCcw,
  RotateCcw,
  Save,
  Trash2,
  UploadCloud,
  Wifi,
} from 'lucide-react';
import { databases, ID, Permission, Role, storage } from '@/lib/appwrite';
import { config } from '@/lib/config';
import { executeFunction } from '@/lib/functions';
import { usePortalData } from '@/lib/portalData';
import type {
  AgentCustomCredential,
  AgentThreadMessage,
  BoardDocument,
  CloudProject,
  CloudProjectDevice,
  CloudProjectSyncEvent,
  FirmwareDocument,
} from '@/lib/types';
import { Badge } from '@/components/ui/Badge';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { FormField, TextArea, TextInput } from '@/components/ui/FormField';
import { PageHeader } from '@/components/ui/Section';

type BoardSecret = {
  apiToken: string;
  commandSecret?: string;
  mqttTopic?: string;
  provisioningPop?: string;
};

type BoardFunctionPayload = {
  board: BoardDocument;
} & BoardSecret;

function time(value?: string | null) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString();
}

function size(bytes?: number) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function statusVariant(status?: string) {
  const clean = String(status || '').toLowerCase();
  if (['online', 'connected', 'success', 'active', 'completed'].includes(clean)) return 'success';
  if (['failed', 'error', 'blocked', 'revoked'].includes(clean)) return 'danger';
  if (['pending', 'requested', 'paused'].includes(clean)) return 'warning';
  return 'default';
}

async function sha256Hex(file: File) {
  const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function firmwarePermissions(userId: string) {
  return [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ];
}

function firmwareFilePermissions(userId: string) {
  return [
    Permission.read(Role.any()),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ];
}

export function DashboardPanel() {
  const { boards, projects, agent, errors, loading, refreshDashboard } = usePortalData();
  const online = boards.filter((board) => board.status === 'online' || board.status === 'connected').length;
  const pendingOta = boards.filter((board) => board.otaStatus === 'pending').length;
  const credits = agent?.creditAccount;

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="Cloud overview"
        actions={
          <Button variant="secondary" type="button" onClick={() => void refreshDashboard({ force: true })}>
            {loading.boards || loading.agent ? <LoaderCircle size={14} className="spin" /> : <RefreshCcw size={14} />} Refresh
          </Button>
        }
      />
      {errors.boards ? <Banner variant="error">{errors.boards}</Banner> : null}
      {errors.agent ? <Banner variant="error">{errors.agent}</Banner> : null}
      {errors.projects ? <Banner variant="error">{errors.projects}</Banner> : null}
      <div className="metric-grid">
        <div className="metric"><span>Cloud boards</span><strong>{boards.length}</strong></div>
        <div className="metric"><span>Online</span><strong>{online}</strong></div>
        <div className="metric"><span>OTA pending</span><strong>{pendingOta}</strong></div>
        <div className="metric"><span>Credits left</span><strong>{credits ? `${credits.remainingCredits}/${credits.monthlyAllowance}` : '-'}</strong></div>
      </div>
      <div className="section-grid">
        <section className="settings-card">
          <h2 style={{ margin: 0, fontSize: 16 }}>Recent boards</h2>
          <CompactTable
            empty="No boards registered yet."
            rows={boards.slice(0, 6).map((board) => [
              <Link key="name" href={`/boards/${board.$id}`}>{board.name}</Link>,
              <Badge key="status" variant={statusVariant(board.status)}>{board.status || 'pending'}</Badge>,
              board.firmwareVersion || '-',
            ])}
          />
        </section>
        <section className="settings-card">
          <h2 style={{ margin: 0, fontSize: 16 }}>Cloud projects</h2>
          <CompactTable
            empty="No cloud projects yet."
            rows={projects.slice(0, 6).map((project) => [
              <Link key="name" href="/projects">{project.name}</Link>,
              <Badge key="status" variant={statusVariant(project.status)}>{project.status || 'active'}</Badge>,
              time(project.lastSyncedAt),
            ])}
          />
        </section>
        <section className="settings-card">
          <h2 style={{ margin: 0, fontSize: 16 }}>Agent activity</h2>
          <CompactTable
            empty="No agent usage yet."
            rows={(agent?.recentUsage || []).slice(0, 6).map((usage) => [
              <code key="mode">{usage.source} / {usage.mode}</code>,
              usage.status,
              `${usage.chargedCredits} credits`,
            ])}
          />
        </section>
      </div>
    </>
  );
}

export function BoardsPanel() {
  const { boards, errors, loading, refreshBoards, user } = usePortalData();
  const [status, setStatus] = useState('');
  const [secret, setSecret] = useState<BoardSecret | null>(null);
  const [form, setForm] = useState({ name: '', boardType: 'esp32:esp32:esp32', otaUpdateMode: 'both', sourceCodeVisibility: 'private' });
  const [creating, setCreating] = useState(false);

  async function createBoard() {
    setStatus('');
    setSecret(null);
    setCreating(true);
    try {
      const response = await executeFunction<BoardFunctionPayload>(config.boardAdminFunctionId, '/', {
        ...form,
        name: form.name.trim() || 'Untitled board',
      });
      setSecret(response);
      setStatus('Board created. Copy the token now; it is only shown once.');
      setForm((current) => ({ ...current, name: '' }));
      await refreshBoards({ force: true });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to create board.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Cloud Boards"
        title="Manage registered boards"
        actions={
          <Button variant="secondary" type="button" onClick={() => void refreshBoards({ force: true })}>
            {loading.boards ? <LoaderCircle size={14} className="spin" /> : <RefreshCcw size={14} />} Refresh
          </Button>
        }
      />
      {errors.boards ? <Banner variant="error">{errors.boards}</Banner> : null}
      {status ? <Banner variant={secret ? 'success' : 'info'}>{status}</Banner> : null}
      {secret ? (
        <section className="settings-card" style={{ marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Provisioning secret</h2>
          <div className="section-grid">
            <SecretValue label="API token" value={secret.apiToken} />
            <SecretValue label="MQTT topic" value={secret.mqttTopic || '-'} />
            <SecretValue label="Proof of possession" value={secret.provisioningPop || '-'} />
          </div>
        </section>
      ) : null}
      <section className="settings-card" style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Register board</h2>
        <div className="section-grid">
          <FormField label="Name">
            <TextInput value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder={`${user.name || 'My'} board`} />
          </FormField>
          <FormField label="Board FQBN">
            <TextInput value={form.boardType} onChange={(event) => setForm((current) => ({ ...current, boardType: event.target.value }))} />
          </FormField>
          <FormField label="OTA mode">
            <select value={form.otaUpdateMode} onChange={(event) => setForm((current) => ({ ...current, otaUpdateMode: event.target.value }))}>
              <option value="both">MQTT with polling fallback</option>
              <option value="mqtt">MQTT only</option>
              <option value="polling">Polling only</option>
            </select>
          </FormField>
        </div>
        <div className="hero-actions">
          <Button variant="primary" type="button" onClick={() => void createBoard()} disabled={creating}>
            {creating ? <LoaderCircle size={14} className="spin" /> : <Plus size={14} />} Create board
          </Button>
        </div>
      </section>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Name</th><th>Board</th><th>Status</th><th>OTA</th><th>Provisioning</th><th>Last seen</th></tr></thead>
          <tbody>
            {boards.map((board) => (
              <tr key={board.$id}>
                <td><Link href={`/boards/${board.$id}`}>{board.name}</Link></td>
                <td><code>{board.boardType}</code></td>
                <td><Badge variant={statusVariant(board.status)}>{board.status || 'pending'}</Badge></td>
                <td><Badge variant={statusVariant(board.otaStatus)}>{board.otaStatus || 'idle'}</Badge></td>
                <td>{board.provisioningStatus || 'pending'}</td>
                <td>{time(board.lastSeen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function BoardDetailPanel({ boardId }: { boardId: string }) {
  const { boards, user, listFirmware, refreshBoards, clearCachedDetail } = usePortalData();
  const board = boards.find((entry) => entry.$id === boardId) || null;
  const [firmware, setFirmware] = useState<FirmwareDocument[]>([]);
  const [status, setStatus] = useState('');
  const [secret, setSecret] = useState<BoardSecret | null>(null);
  const [busy, setBusy] = useState('');
  const [upload, setUpload] = useState({ version: '', notes: '' });
  const [file, setFile] = useState<File | null>(null);

  async function loadFirmware(force = false) {
    setFirmware(await listFirmware(boardId, { force }));
  }

  useEffect(() => {
    void loadFirmware();
  }, [boardId]);

  async function rotateToken() {
    setBusy('rotate');
    setStatus('');
    setSecret(null);
    try {
      const response = await executeFunction<BoardFunctionPayload>(config.boardAdminFunctionId, '/rotate-token', { boardId });
      setSecret(response);
      setStatus('Board token rotated. Re-provision the board before using cloud runtime commands.');
      await refreshBoards({ force: true });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Token rotation failed.');
    } finally {
      setBusy('');
    }
  }

  async function startProvisioning() {
    setBusy('provision');
    setStatus('');
    try {
      const response = await executeFunction<{ board: BoardDocument; mqtt?: { status?: string; reason?: string }; provisioning?: { serviceName: string; pop: string } }>(
        config.boardAdminFunctionId,
        '/start-provisioning',
        { boardId, mode: 'auto' },
      );
      setStatus(`Provisioning requested${response.mqtt?.status ? ` (${response.mqtt.status})` : ''}. ${response.provisioning?.serviceName || ''}`);
      await refreshBoards({ force: true });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Provisioning request failed.');
    } finally {
      setBusy('');
    }
  }

  async function saveBoard() {
    if (!board) return;
    setBusy('save');
    setStatus('');
    try {
      await databases.updateDocument(config.databaseId, config.boardsCollectionId, boardId, {
        name: board.name,
        otaUpdateMode: board.otaUpdateMode || 'both',
        sourceCodeVisibility: board.sourceCodeVisibility || 'private',
        updatedAt: new Date().toISOString(),
      });
      setStatus('Board settings saved.');
      await refreshBoards({ force: true });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to save board.');
    } finally {
      setBusy('');
    }
  }

  async function deploy(firmwareId: string) {
    setBusy(`deploy:${firmwareId}`);
    setStatus('');
    try {
      await executeFunction(config.boardAdminFunctionId, '/deploy-firmware', {
        boardId,
        firmwareId,
        deploymentId: `web_${Date.now()}`,
      });
      setStatus('Firmware deployment queued.');
      clearCachedDetail(`firmware:${boardId}`);
      await Promise.all([refreshBoards({ force: true }), loadFirmware(true)]);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Deployment failed.');
    } finally {
      setBusy('');
    }
  }

  async function uploadFirmware() {
    if (!board || !file) {
      setStatus('Choose a firmware .bin file first.');
      return;
    }

    setBusy('upload');
    setStatus('');
    const firmwareId = ID.unique();
    try {
      const checksum = await sha256Hex(file);
      const stored = await storage.createFile(config.firmwareBucketId, firmwareId, file, firmwareFilePermissions(user.$id));
      const now = new Date().toISOString();
      const release = await databases.createDocument<FirmwareDocument>(
        config.databaseId,
        config.firmwareCollectionId,
        firmwareId,
        {
          userId: user.$id,
          boardId,
          version: upload.version.trim() || new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12),
          fileId: stored.$id,
          filename: file.name,
          size: file.size,
          checksum,
          uploadedAt: now,
          deployed: false,
          notes: upload.notes,
          sourceSnapshotFileId: '',
          sourceSnapshotChecksum: '',
          sourceSnapshotManifest: '',
          sourceSnapshotCreatedAt: '',
        },
        firmwarePermissions(user.$id),
      );
      setStatus('Firmware uploaded.');
      setFile(null);
      setUpload({ version: '', notes: '' });
      clearCachedDetail(`firmware:${boardId}`);
      await loadFirmware(true);
      await deploy(release.$id);
    } catch (error) {
      await storage.deleteFile(config.firmwareBucketId, firmwareId).catch(() => undefined);
      setStatus(error instanceof Error ? error.message : 'Firmware upload failed.');
    } finally {
      setBusy('');
    }
  }

  async function deleteFirmware(release: FirmwareDocument) {
    setBusy(`delete:${release.$id}`);
    setStatus('');
    try {
      if (release.fileId) {
        await storage.deleteFile(config.firmwareBucketId, release.fileId);
      }
      if (release.sourceSnapshotFileId && config.firmwareSourceBucketId) {
        await storage.deleteFile(config.firmwareSourceBucketId, release.sourceSnapshotFileId).catch(() => undefined);
      }
      await databases.deleteDocument(config.databaseId, config.firmwareCollectionId, release.$id);
      setStatus('Firmware release deleted.');
      clearCachedDetail(`firmware:${boardId}`);
      await loadFirmware(true);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to delete firmware release.');
    } finally {
      setBusy('');
    }
  }

  async function deleteBoard() {
    setBusy('delete-board');
    setStatus('');
    try {
      await databases.deleteDocument(config.databaseId, config.boardsCollectionId, boardId);
      setStatus('Board deleted.');
      await refreshBoards({ force: true });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to delete board.');
    } finally {
      setBusy('');
    }
  }

  if (!board) {
    return (
      <>
        <PageHeader eyebrow="Board" title="Loading board" />
        <Banner variant="info">Waiting for the shared board cache. Refresh if this board was just created.</Banner>
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Board" title={board.name} />
      {status ? <Banner variant={secret ? 'success' : 'info'}>{status}</Banner> : null}
      {secret ? (
        <section className="settings-card" style={{ marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>New provisioning secret</h2>
          <div className="section-grid">
            <SecretValue label="API token" value={secret.apiToken} />
            <SecretValue label="MQTT topic" value={secret.mqttTopic || '-'} />
            <SecretValue label="Proof of possession" value={secret.provisioningPop || '-'} />
          </div>
        </section>
      ) : null}
      <div className="metric-grid">
        <div className="metric"><span>Status</span><strong>{board.status || 'pending'}</strong></div>
        <div className="metric"><span>OTA</span><strong>{board.otaStatus || 'idle'}</strong></div>
        <div className="metric"><span>Runtime</span><strong>{board.runtimeVersion || '-'}</strong></div>
        <div className="metric"><span>Last seen</span><strong style={{ fontSize: 14 }}>{time(board.lastSeen)}</strong></div>
      </div>
      {board.lastOtaError ? <div style={{ marginTop: 16 }}><Banner variant="error">{board.lastOtaError}</Banner></div> : null}
      <section className="settings-card" style={{ marginTop: 20 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Board settings</h2>
        <div className="section-grid">
          <FormField label="OTA mode">
            <select
              value={board.otaUpdateMode || 'both'}
              onChange={(event) => {
                board.otaUpdateMode = event.target.value;
                void saveBoard();
              }}
            >
              <option value="both">MQTT with polling fallback</option>
              <option value="mqtt">MQTT only</option>
              <option value="polling">Polling only</option>
            </select>
          </FormField>
          <FormField label="Source visibility">
            <select
              value={board.sourceCodeVisibility || 'private'}
              onChange={(event) => {
                board.sourceCodeVisibility = event.target.value;
                void saveBoard();
              }}
            >
              <option value="private">Private</option>
              <option value="public">Public</option>
            </select>
          </FormField>
          <FormField label="Token preview">
            <TextInput readOnly value={board.tokenPreview || ''} />
          </FormField>
        </div>
        <div className="hero-actions">
          <Button variant="secondary" type="button" onClick={() => void startProvisioning()} disabled={busy === 'provision'}>
            <Wifi size={14} /> Start provisioning
          </Button>
          <Button variant="secondary" type="button" onClick={() => void rotateToken()} disabled={busy === 'rotate'}>
            <RotateCcw size={14} /> Rotate token
          </Button>
          <Button variant="ghost" type="button" onClick={() => void deleteBoard()} disabled={busy === 'delete-board'}>
            <Trash2 size={14} /> Delete board
          </Button>
        </div>
      </section>
      <section className="settings-card" style={{ marginTop: 20 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Upload firmware</h2>
        <div className="section-grid">
          <FormField label="Version">
            <TextInput value={upload.version} onChange={(event) => setUpload((current) => ({ ...current, version: event.target.value }))} placeholder="1.0.0" />
          </FormField>
          <FormField label="Firmware file">
            <TextInput type="file" accept=".bin,application/octet-stream" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          </FormField>
          <FormField label="Notes">
            <TextInput value={upload.notes} onChange={(event) => setUpload((current) => ({ ...current, notes: event.target.value }))} />
          </FormField>
        </div>
        <div className="hero-actions">
          <Button variant="primary" type="button" onClick={() => void uploadFirmware()} disabled={busy === 'upload'}>
            {busy === 'upload' ? <LoaderCircle size={14} className="spin" /> : <UploadCloud size={14} />} Upload and deploy
          </Button>
        </div>
      </section>
      <section className="settings-card" style={{ marginTop: 20 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Firmware releases</h2>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Version</th><th>File</th><th>Uploaded</th><th>Status</th><th /></tr></thead>
            <tbody>
              {firmware.map((release) => (
                <tr key={release.$id}>
                  <td>{release.version}</td>
                  <td>{release.filename}<br /><span className="muted">{size(release.size)}</span></td>
                  <td>{time(release.uploadedAt)}</td>
                  <td>{release.deployed ? <Badge variant="success">Desired</Badge> : 'Available'}</td>
                  <td>
                    <div className="row-actions">
                      <Button variant="secondary" size="sm" type="button" onClick={() => void deploy(release.$id)} disabled={release.deployed || busy === `deploy:${release.$id}`}>
                        Deploy
                      </Button>
                      <Button variant="ghost" size="sm" type="button" onClick={() => void deleteFirmware(release)} disabled={busy === `delete:${release.$id}`}>
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {firmware.length === 0 ? <tr><td colSpan={5}>No firmware releases uploaded yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export function ProjectsPanel() {
  const { projects, loading, errors, refreshProjects, listProjectDevices, listProjectEvents, clearCachedDetail } = usePortalData();
  const [selectedId, setSelectedId] = useState('');
  const selected = projects.find((project) => project.$id === selectedId) || projects[0] || null;
  const [devices, setDevices] = useState<CloudProjectDevice[]>([]);
  const [events, setEvents] = useState<CloudProjectSyncEvent[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState('');
  const [form, setForm] = useState({ name: '', deviceId: '', deviceName: '', sshPublicKey: '' });

  useEffect(() => {
    if (!selectedId && projects[0]) setSelectedId(projects[0].$id);
  }, [projects, selectedId]);

  useEffect(() => {
    if (!selected) return;
    void Promise.all([listProjectDevices(selected.$id), listProjectEvents(selected.$id)]).then(([nextDevices, nextEvents]) => {
      setDevices(nextDevices);
      setEvents(nextEvents);
    });
  }, [listProjectDevices, listProjectEvents, selected]);

  async function createProject() {
    setBusy('create-project');
    setStatus('');
    try {
      await executeFunction(config.projectSyncFunctionId, '/projects/create', {
        name: form.name.trim() || 'Untitled project',
        deviceId: form.deviceId.trim(),
        deviceName: form.deviceName.trim() || form.deviceId.trim(),
        sshPublicKey: form.sshPublicKey.trim(),
      });
      setForm({ name: '', deviceId: '', deviceName: '', sshPublicKey: '' });
      setStatus('Cloud project created.');
      await refreshProjects({ force: true });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to create project.');
    } finally {
      setBusy('');
    }
  }

  async function revokeDevice(device: CloudProjectDevice) {
    if (!selected) return;
    setBusy(`revoke:${device.$id}`);
    setStatus('');
    try {
      await executeFunction(config.projectSyncFunctionId, '/projects/revoke-device', {
        projectId: selected.$id,
        deviceId: device.deviceId,
      });
      setStatus('Device revoked.');
      clearCachedDetail(`project-devices:${selected.$id}`);
      setDevices(await listProjectDevices(selected.$id, { force: true }));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to revoke device.');
    } finally {
      setBusy('');
    }
  }

  async function deleteProject(project: CloudProject) {
    setBusy(`delete:${project.$id}`);
    setStatus('');
    try {
      await executeFunction(config.projectSyncFunctionId, '/projects/delete', { projectId: project.$id });
      setStatus('Cloud project deleted.');
      await refreshProjects({ force: true });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to delete project.');
    } finally {
      setBusy('');
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Cloud Projects"
        title="Manage synced projects"
        actions={
          <Button variant="secondary" type="button" onClick={() => void refreshProjects({ force: true })}>
            {loading.projects ? <LoaderCircle size={14} className="spin" /> : <RefreshCcw size={14} />} Refresh
          </Button>
        }
      />
      {errors.projects ? <Banner variant="error">{errors.projects}</Banner> : null}
      {status ? <Banner variant="info">{status}</Banner> : null}
      <section className="settings-card" style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Create cloud project</h2>
        <div className="section-grid">
          <FormField label="Project name">
            <TextInput value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
          </FormField>
          <FormField label="Device ID">
            <TextInput value={form.deviceId} onChange={(event) => setForm((current) => ({ ...current, deviceId: event.target.value }))} placeholder="desktop-device-id" />
          </FormField>
          <FormField label="Device name">
            <TextInput value={form.deviceName} onChange={(event) => setForm((current) => ({ ...current, deviceName: event.target.value }))} />
          </FormField>
        </div>
        <FormField label="SSH public key">
          <TextArea rows={3} value={form.sshPublicKey} onChange={(event) => setForm((current) => ({ ...current, sshPublicKey: event.target.value }))} placeholder="ssh-ed25519 ..." />
        </FormField>
        <div className="hero-actions">
          <Button variant="primary" type="button" onClick={() => void createProject()} disabled={busy === 'create-project'}>
            <Plus size={14} /> Create project
          </Button>
        </div>
      </section>
      <div className="portal-split">
        <section className="settings-card">
          <h2 style={{ margin: 0, fontSize: 16 }}>Projects</h2>
          <div className="row-list">
            {projects.map((project) => (
              <button key={project.$id} className={`row-list__item ${selected?.$id === project.$id ? 'active' : ''}`} type="button" onClick={() => setSelectedId(project.$id)}>
                <strong>{project.name}</strong>
                <span>{project.repoOwner}/{project.repoName}</span>
                <Badge variant={statusVariant(project.status)}>{project.status || 'active'}</Badge>
              </button>
            ))}
            {projects.length === 0 ? <p>No cloud projects yet.</p> : null}
          </div>
        </section>
        <section className="settings-card">
          {selected ? (
            <>
              <div className="panel-heading-row">
                <div>
                  <h2 style={{ margin: 0, fontSize: 16 }}>{selected.name}</h2>
                  <p className="muted">{time(selected.lastSyncedAt)} last sync</p>
                </div>
                <Button variant="ghost" type="button" onClick={() => void deleteProject(selected)} disabled={busy === `delete:${selected.$id}`}>
                  <Trash2 size={14} /> Delete
                </Button>
              </div>
              <FormField label="SSH clone URL">
                <TextInput readOnly value={selected.git?.sshCloneUrl || selected.sshCloneUrl || ''} />
              </FormField>
              <h3>Linked devices</h3>
              <div className="table-wrap">
                <table className="table">
                  <tbody>
                    {devices.map((device) => (
                      <tr key={device.$id}>
                        <td>{device.deviceName}<br /><code>{device.deviceId}</code></td>
                        <td><Badge variant={statusVariant(device.status)}>{device.status}</Badge></td>
                        <td>{time(device.updatedAt)}</td>
                        <td>
                          <Button variant="ghost" type="button" onClick={() => void revokeDevice(device)} disabled={busy === `revoke:${device.$id}`}>
                            Revoke
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {devices.length === 0 ? <tr><td>No devices linked.</td></tr> : null}
                  </tbody>
                </table>
              </div>
              <h3>Sync history</h3>
              <div className="table-wrap">
                <table className="table">
                  <tbody>
                    {events.map((event) => (
                      <tr key={event.$id}>
                        <td>{event.operation}</td>
                        <td><Badge variant={statusVariant(event.status)}>{event.status}</Badge></td>
                        <td>{event.message || event.commitHash || '-'}</td>
                        <td>{time(event.createdAt)}</td>
                      </tr>
                    ))}
                    {events.length === 0 ? <tr><td>No sync events yet.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </>
          ) : <p>Select a project to view details.</p>}
        </section>
      </div>
    </>
  );
}

export function AgentsPanel() {
  const { agent, errors, loading, refreshAgent, listThreadMessages } = usePortalData();
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState('');
  const [credential, setCredential] = useState({ displayName: '', baseUrl: '', apiKey: '', modelNames: '', enabled: true });
  const [preferences, setPreferences] = useState({ selectedSource: 'managed', defaultMode: 'fast', selectedCustomCredentialId: '', selectedCustomModelName: '' });
  const [selectedThreadId, setSelectedThreadId] = useState('');
  const [messages, setMessages] = useState<AgentThreadMessage[]>([]);
  const usage = agent?.recentUsage || [];
  const credits = agent?.creditAccount;
  const usedPercent = useMemo(() => {
    if (!credits?.monthlyAllowance) return 0;
    return Math.min(100, Math.round((credits.usedCredits / credits.monthlyAllowance) * 100));
  }, [credits]);

  useEffect(() => {
    if (agent?.preferences) {
      setPreferences({
        selectedSource: agent.preferences.selectedSource || 'managed',
        defaultMode: agent.preferences.defaultMode || 'fast',
        selectedCustomCredentialId: agent.preferences.selectedCustomCredentialId || '',
        selectedCustomModelName: agent.preferences.selectedCustomModelName || '',
      });
    }
  }, [agent?.preferences]);

  async function savePreferences() {
    setBusy('preferences');
    setStatus('');
    try {
      await executeFunction(config.agentSettingsFunctionId, '/preferences', {
        ...preferences,
        selectedCustomCredentialId: preferences.selectedCustomCredentialId || null,
        selectedCustomModelName: preferences.selectedCustomModelName || null,
      });
      setStatus('Agent preferences saved.');
      await refreshAgent({ force: true });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to save preferences.');
    } finally {
      setBusy('');
    }
  }

  async function createCredential() {
    setBusy('credential');
    setStatus('');
    try {
      await executeFunction<AgentCustomCredential>(config.agentSettingsFunctionId, '/custom-credentials/create', {
        ...credential,
        modelNames: credential.modelNames,
      });
      setCredential({ displayName: '', baseUrl: '', apiKey: '', modelNames: '', enabled: true });
      setStatus('Custom credential saved.');
      await refreshAgent({ force: true });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to save credential.');
    } finally {
      setBusy('');
    }
  }

  async function deleteCredential(id: string) {
    setBusy(`delete:${id}`);
    setStatus('');
    try {
      await executeFunction(config.agentSettingsFunctionId, '/custom-credentials/delete', { credentialId: id });
      setStatus('Credential deleted.');
      await refreshAgent({ force: true });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to delete credential.');
    } finally {
      setBusy('');
    }
  }

  async function testCredential(id: string) {
    setBusy(`test:${id}`);
    setStatus('');
    try {
      await executeFunction(config.agentSettingsFunctionId, '/custom-credentials/test', { credentialId: id });
      setStatus('Credential test passed.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Credential test failed.');
    } finally {
      setBusy('');
    }
  }

  async function openThread(threadId: string) {
    setSelectedThreadId(threadId);
    setMessages(await listThreadMessages(threadId, { force: true }));
  }

  async function deleteThread(threadId: string) {
    setBusy(`thread-delete:${threadId}`);
    setStatus('');
    try {
      await executeFunction(config.agentSettingsFunctionId, '/threads/delete', { threadId });
      setStatus('Thread deleted.');
      setSelectedThreadId('');
      setMessages([]);
      await refreshAgent({ force: true });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to delete thread.');
    } finally {
      setBusy('');
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Agents"
        title="Models, usage, and threads"
        actions={
          <Button variant="secondary" type="button" onClick={() => void refreshAgent({ force: true })}>
            {loading.agent ? <LoaderCircle size={14} className="spin" /> : <RefreshCcw size={14} />} Refresh
          </Button>
        }
      />
      {errors.agent ? <Banner variant="error">{errors.agent}</Banner> : null}
      {status ? <Banner variant="info">{status}</Banner> : null}
      <div className="metric-grid">
        <div className="metric"><span>Managed models</span><strong>{agent?.managedAvailable ? 'On' : 'Off'}</strong></div>
        <div className="metric"><span>Credits used</span><strong>{credits ? `${credits.usedCredits}` : '-'}</strong></div>
        <div className="metric"><span>Credits left</span><strong>{credits ? `${credits.remainingCredits}` : '-'}</strong></div>
        <div className="metric"><span>Usage</span><strong>{usedPercent}%</strong></div>
      </div>
      <section className="settings-card" style={{ marginTop: 20 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Agent preferences</h2>
        <div className="section-grid">
          <FormField label="Source">
            <select value={preferences.selectedSource} onChange={(event) => setPreferences((current) => ({ ...current, selectedSource: event.target.value }))}>
              <option value="managed">Managed pool</option>
              <option value="custom">Custom key</option>
            </select>
          </FormField>
          <FormField label="Default mode">
            <select value={preferences.defaultMode} onChange={(event) => setPreferences((current) => ({ ...current, defaultMode: event.target.value }))}>
              <option value="fast">Fast</option>
              <option value="power">Power</option>
            </select>
          </FormField>
          <FormField label="Custom credential">
            <select value={preferences.selectedCustomCredentialId} onChange={(event) => setPreferences((current) => ({ ...current, selectedCustomCredentialId: event.target.value }))}>
              <option value="">None</option>
              {(agent?.customCredentials || []).map((entry) => <option key={entry.id} value={entry.id}>{entry.displayName}</option>)}
            </select>
          </FormField>
        </div>
        <div className="hero-actions">
          <Button variant="primary" type="button" onClick={() => void savePreferences()} disabled={busy === 'preferences'}>
            <Save size={14} /> Save preferences
          </Button>
        </div>
      </section>
      <section className="settings-card" style={{ marginTop: 20 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Custom credentials</h2>
        <div className="section-grid">
          <FormField label="Display name">
            <TextInput value={credential.displayName} onChange={(event) => setCredential((current) => ({ ...current, displayName: event.target.value }))} />
          </FormField>
          <FormField label="Base URL">
            <TextInput value={credential.baseUrl} onChange={(event) => setCredential((current) => ({ ...current, baseUrl: event.target.value }))} placeholder="https://api.openai.com/v1" />
          </FormField>
          <FormField label="Models">
            <TextInput value={credential.modelNames} onChange={(event) => setCredential((current) => ({ ...current, modelNames: event.target.value }))} placeholder="gpt-4.1, gpt-5.5" />
          </FormField>
        </div>
        <FormField label="API key">
          <TextInput type="password" value={credential.apiKey} onChange={(event) => setCredential((current) => ({ ...current, apiKey: event.target.value }))} />
        </FormField>
        <div className="hero-actions">
          <Button variant="primary" type="button" onClick={() => void createCredential()} disabled={busy === 'credential'}>
            <KeyRound size={14} /> Add credential
          </Button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <tbody>
              {(agent?.customCredentials || []).map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.displayName}<br /><code>{entry.baseUrl}</code></td>
                  <td>{entry.modelNames.join(', ')}</td>
                  <td>{entry.enabled ? <Badge variant="success">Enabled</Badge> : <Badge variant="warning">Disabled</Badge>}</td>
                  <td>{entry.apiKeyPreview || '-'}</td>
                  <td>
                    <div className="row-actions">
                      <Button variant="secondary" type="button" onClick={() => void testCredential(entry.id)} disabled={busy === `test:${entry.id}`}>Test</Button>
                      <Button variant="ghost" type="button" onClick={() => void deleteCredential(entry.id)} disabled={busy === `delete:${entry.id}`}><Trash2 size={13} /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {(agent?.customCredentials || []).length === 0 ? <tr><td>No custom credentials yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
      <section className="settings-card" style={{ marginTop: 20 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Recent usage</h2>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Mode</th><th>Status</th><th>Model</th><th>Tokens</th><th>Credits</th><th>Created</th></tr></thead>
            <tbody>
              {usage.map((event) => (
                <tr key={event.id}>
                  <td><code>{event.source} / {event.mode}</code></td>
                  <td><Badge variant={statusVariant(event.status)}>{event.status}</Badge></td>
                  <td>{'modelAlias' in event && typeof event.modelAlias === 'string' ? event.modelAlias : '-'}</td>
                  <td>{event.totalTokens}</td>
                  <td>{event.chargedCredits}</td>
                  <td>{time(event.createdAt)}</td>
                </tr>
              ))}
              {usage.length === 0 ? <tr><td colSpan={6}>No usage yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
      <section className="settings-card" style={{ marginTop: 20 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Cloud threads</h2>
        <div className="portal-split">
          <div className="row-list">
            {(agent?.recentThreads || []).map((thread) => (
              <button key={thread.id} className={`row-list__item ${selectedThreadId === thread.id ? 'active' : ''}`} type="button" onClick={() => void openThread(thread.id)}>
                <strong>{thread.title}</strong>
                <span>{thread.messageCount} messages • {time(thread.lastMessageAt)}</span>
              </button>
            ))}
            {(agent?.recentThreads || []).length === 0 ? <p>No cloud threads yet.</p> : null}
          </div>
          <div className="message-list">
            {selectedThreadId ? (
              <div className="panel-heading-row">
                <strong>Messages</strong>
                <Button variant="ghost" type="button" onClick={() => void deleteThread(selectedThreadId)} disabled={busy === `thread-delete:${selectedThreadId}`}>
                  <Trash2 size={14} /> Delete thread
                </Button>
              </div>
            ) : null}
            {messages.map((message) => (
              <article key={message.id} className={`message-bubble message-bubble--${message.role}`}>
                <strong>{message.role}</strong>
                <p>{message.content}</p>
              </article>
            ))}
            {!selectedThreadId ? <p>Select a thread to inspect messages.</p> : null}
          </div>
        </div>
      </section>
    </>
  );
}

function SecretValue({ label, value }: { label: string; value: string }) {
  return (
    <FormField label={label}>
      <TextInput readOnly value={value} onFocus={(event) => event.currentTarget.select()} />
    </FormField>
  );
}

function CompactTable({ rows, empty }: { rows: Array<Array<ReactNode>>; empty: string }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}
            </tr>
          ))}
          {rows.length === 0 ? <tr><td>{empty}</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}
