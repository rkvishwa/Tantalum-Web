import type { Models } from 'appwrite';

export type User = Models.User<Models.Preferences>;

export type BoardDocument = Models.Document & {
  userId: string;
  name: string;
  boardType: string;
  firmwareVersion?: string;
  status?: string;
  otaStatus?: string;
  provisioningStatus?: string;
  lastSeen?: string | null;
  tokenPreview?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type FirmwareDocument = Models.Document & {
  userId: string;
  boardId: string;
  version: string;
  fileId?: string;
  filename: string;
  size: number;
  checksum?: string;
  deployed: boolean;
  uploadedAt: string;
  notes?: string;
  sourceSnapshotFileId?: string;
  sourceSnapshotChecksum?: string;
  sourceSnapshotManifest?: string;
  sourceSnapshotCreatedAt?: string;
};

export type AgentSettingsState = {
  managedAvailable: boolean;
  managedModes?: Array<{
    id: string;
    label: string;
    creditMultiplier: number;
    model: string;
    editorModel?: string;
    contextWindow?: number | null;
    repoMapTokens?: number;
    reasoningEffort?: string | null;
  }>;
  managedModelMetadata?: {
    providerLabel: string;
    fastModel: string;
    fastEditorModel?: string;
    powerModel: string;
    powerEditorModel?: string;
    powerReasoningEffort?: string;
    repoMapTokens?: number;
  };
  preferences?: {
    selectedSource: 'managed' | 'custom' | string;
    defaultMode: 'fast' | 'power' | string;
    selectedCustomCredentialId: string | null;
    selectedCustomModelName?: string | null;
  };
  customCredentials?: AgentCustomCredential[];
  creditAccount: {
    id?: string;
    periodKey?: string;
    monthlyAllowance: number;
    usedCredits: number;
    remainingCredits: number;
    resetAt: string;
  };
  recentUsage: Array<{
    id: string;
    source: string;
    mode: string;
    status: string;
    totalTokens: number;
    chargedCredits: number;
    createdAt: string;
    errorMessage?: string | null;
  }>;
  recentThreads: Array<{
    id: string;
    title: string;
    workspaceKey?: string | null;
    workspaceName?: string | null;
    status: string;
    messageCount: number;
    lastMessagePreview?: string;
    createdAt?: string;
    updatedAt?: string;
    lastMessageAt: string;
  }>;
};

export type AgentCustomCredential = {
  id: string;
  displayName: string;
  baseUrl: string;
  modelNames: string[];
  enabled: boolean;
  apiKeyPreview: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string | null;
};

export type AgentThreadMessage = {
  id: string;
  threadId: string;
  role: string;
  content: string;
  tone: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type CloudProject = Models.Document & {
  userId: string;
  name: string;
  repoOwner: string;
  repoName: string;
  sshCloneUrl: string;
  defaultBranch: string;
  status: string;
  quotaMb: number;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
  git?: {
    owner: string;
    repo: string;
    branch: string;
    sshHost: string;
    sshPort: number;
    sshCloneUrl: string;
    webUrl: string;
  };
};

export type CloudProjectDevice = Models.Document & {
  userId: string;
  projectId: string;
  deviceId: string;
  deviceName: string;
  sshPublicKeyFingerprint: string;
  giteaKeyId?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  revokedAt?: string;
};

export type CloudProjectSyncEvent = Models.Document & {
  userId: string;
  projectId: string;
  deviceId?: string;
  operation: string;
  status: string;
  commitHash?: string;
  branch?: string;
  message?: string;
  createdAt: string;
};

export type AdminDashboard = {
  totals: {
    users: number;
    boards: number;
    recentUsageEvents: number;
    chargedCredits: number;
    projects?: number;
    supportTickets?: number;
    settings?: number;
  };
  recentUsers: AdminUser[];
  recentUsage: AdminUsage[];
  creditAccounts: AdminCredit[];
  settings: AdminSetting[];
  projects?: AdminCloudProject[];
  supportTickets?: AdminSupportTicket[];
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  status: boolean;
  labels: string[];
  emailVerification: boolean;
  registration: string | null;
  accessedAt: string | null;
};

export type AdminUsage = {
  id: string;
  userId: string;
  source: string;
  mode: string;
  status: string;
  providerLabel: string;
  modelAlias: string;
  totalTokens: number;
  chargedCredits: number;
  createdAt: string;
  errorMessage: string;
};

export type AdminCredit = {
  id: string;
  userId: string;
  periodKey: string;
  monthlyAllowance: number;
  usedCredits: number;
  resetAt: string;
  updatedAt: string;
};

export type AdminSetting = {
  id: string;
  key: string;
  value: string;
  description: string;
  updatedAt: string;
};

export type AdminCloudProject = {
  id: string;
  userId: string;
  name: string;
  repoOwner: string;
  repoName: string;
  status: string;
  quotaMb: number;
  lastSyncedAt: string;
  updatedAt: string;
};

export type AdminSupportTicket = {
  id: string;
  userId: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminModelPoolKey = {
  id: string;
  providerLabel: string;
  baseUrl: string;
  status: string;
  fastModel: string;
  fastEditorModel: string;
  powerModel: string;
  powerEditorModel: string;
  assignmentWeight: number;
  maxAssignments: number;
  assignedCount: number;
  apiKeyPreview: string;
  updatedAt: string;
};

export type AdminUtilityModel = {
  id: string;
  providerLabel: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
  taskTags: string[];
  priority: number;
  apiKeyPreview: string;
  updatedAt: string;
};

export type AdminOperationRun = {
  id: string;
  actorUserId: string;
  operation: string;
  target: string;
  status: string;
  preflightJson?: string;
  resultJson?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

export type AdminAuditEvent = {
  id: string;
  actorUserId: string;
  action: string;
  target: string;
  status: string;
  message: string;
  metadataJson?: string;
  createdAt: string;
};

export type AdminLogEntry = {
  id: string;
  source: string;
  service: string;
  severity: string;
  status?: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
};

export type AdminLogQueryResult = {
  entries: AdminLogEntry[];
  nextCursor?: string;
  exportedText?: string;
};
