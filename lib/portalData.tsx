'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Models } from 'appwrite';
import { account, databases, Query, subscribe } from './appwrite';
import { config } from './config';
import { executeFunction } from './functions';
import type {
  AgentSettingsState,
  AgentThreadMessage,
  BoardDocument,
  CloudProject,
  CloudProjectDevice,
  CloudProjectSyncEvent,
  FirmwareDocument,
  User,
} from './types';

type RealtimeEvent = {
  events?: string[];
  channels?: string[];
  payload?: unknown;
};

type LoadOptions = {
  force?: boolean;
};

type PortalDataContextValue = {
  user: User;
  boards: BoardDocument[];
  agent: AgentSettingsState | null;
  projects: CloudProject[];
  sessions: Models.Session[];
  loading: Record<string, boolean>;
  errors: Record<string, string>;
  refreshDashboard: (options?: LoadOptions) => Promise<void>;
  refreshBoards: (options?: LoadOptions) => Promise<BoardDocument[]>;
  refreshAgent: (options?: LoadOptions) => Promise<AgentSettingsState | null>;
  refreshProjects: (options?: LoadOptions) => Promise<CloudProject[]>;
  refreshSessions: (options?: LoadOptions) => Promise<Models.Session[]>;
  listFirmware: (boardId: string, options?: LoadOptions) => Promise<FirmwareDocument[]>;
  listProjectDevices: (projectId: string, options?: LoadOptions) => Promise<CloudProjectDevice[]>;
  listProjectEvents: (projectId: string, options?: LoadOptions) => Promise<CloudProjectSyncEvent[]>;
  listThreadMessages: (threadId: string, options?: LoadOptions) => Promise<AgentThreadMessage[]>;
  clearCachedDetail: (prefix: string) => void;
};

const PortalDataContext = createContext<PortalDataContextValue | null>(null);

const LIST_TTL_MS = 2 * 60 * 1000;
const DETAIL_TTL_MS = 90 * 1000;
const FALLBACK_REFRESH_MS = 60 * 1000;

function collectionChannel(collectionId: string) {
  return `databases.${config.databaseId}.collections.${collectionId}.documents`;
}

function eventAction(event: RealtimeEvent) {
  const events = event.events || [];
  if (events.some((entry) => entry.endsWith('.delete'))) return 'delete';
  if (events.some((entry) => entry.endsWith('.create'))) return 'create';
  if (events.some((entry) => entry.endsWith('.update'))) return 'update';
  return 'unknown';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function sortByUpdatedAt<T extends { updatedAt?: string; createdAt?: string; $createdAt?: string }>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftDate = Date.parse(left.updatedAt || left.createdAt || left.$createdAt || '');
    const rightDate = Date.parse(right.updatedAt || right.createdAt || right.$createdAt || '');
    return rightDate - leftDate;
  });
}

function sortBoards(boards: BoardDocument[]) {
  return [...boards].sort((left, right) => Date.parse(right.createdAt || right.$createdAt || '') - Date.parse(left.createdAt || left.$createdAt || ''));
}

function sortFirmware(firmware: FirmwareDocument[]) {
  return [...firmware].sort((left, right) => Date.parse(right.uploadedAt || right.$createdAt || '') - Date.parse(left.uploadedAt || left.$createdAt || ''));
}

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function PortalDataProvider({ user, children }: { user: User; children: React.ReactNode }) {
  const [boards, setBoards] = useState<BoardDocument[]>([]);
  const [agent, setAgent] = useState<AgentSettingsState | null>(null);
  const [projects, setProjects] = useState<CloudProject[]>([]);
  const [sessions, setSessions] = useState<Models.Session[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const loadedAtRef = useRef<Record<string, number>>({});
  const detailCacheRef = useRef<Record<string, unknown>>({});
  const inFlightRef = useRef<Partial<Record<string, Promise<unknown>>>>({});

  const setBusy = useCallback((key: string, busy: boolean) => {
    setLoading((current) => ({ ...current, [key]: busy }));
  }, []);

  const setError = useCallback((key: string, error: string) => {
    setErrors((current) => ({ ...current, [key]: error }));
  }, []);

  const cached = useCallback(<T,>(key: string, ttlMs: number, loader: () => Promise<T>, options: LoadOptions = {}) => {
    const now = Date.now();
    if (!options.force && detailCacheRef.current[key] && now - (loadedAtRef.current[key] || 0) < ttlMs) {
      return Promise.resolve(detailCacheRef.current[key] as T);
    }

    if (!options.force && inFlightRef.current[key]) {
      return inFlightRef.current[key] as Promise<T>;
    }

    const promise = loader()
      .then((value) => {
        detailCacheRef.current[key] = value;
        loadedAtRef.current[key] = Date.now();
        return value;
      })
      .finally(() => {
        delete inFlightRef.current[key];
      });

    inFlightRef.current[key] = promise as Promise<unknown>;
    return promise;
  }, []);

  const refreshBoards = useCallback(async (options: LoadOptions = {}) => {
    const key = 'boards';
    setBusy(key, true);
    setError(key, '');
    try {
      const documents = await cached(
        key,
        LIST_TTL_MS,
        async () => {
          const response = await databases.listDocuments<BoardDocument>(config.databaseId, config.boardsCollectionId, [
            Query.limit(100),
            Query.orderDesc('createdAt'),
          ]);
          return sortBoards(response.documents);
        },
        options,
      );
      setBoards(documents);
      return documents;
    } catch (error) {
      setError(key, messageFrom(error, 'Unable to load cloud boards.'));
      return [];
    } finally {
      setBusy(key, false);
    }
  }, [cached, setBusy, setError]);

  const refreshAgent = useCallback(async (options: LoadOptions = {}) => {
    const key = 'agent';
    setBusy(key, true);
    setError(key, '');
    try {
      const data = await cached(
        key,
        LIST_TTL_MS,
        () => executeFunction<AgentSettingsState>(config.agentSettingsFunctionId, '/bootstrap', { includeUsage: true }),
        options,
      );
      setAgent(data);
      return data;
    } catch (error) {
      setError(key, messageFrom(error, 'Unable to load agent settings.'));
      return null;
    } finally {
      setBusy(key, false);
    }
  }, [cached, setBusy, setError]);

  const refreshProjects = useCallback(async (options: LoadOptions = {}) => {
    const key = 'projects';
    setBusy(key, true);
    setError(key, '');
    try {
      const documents = await cached(
        key,
        LIST_TTL_MS,
        async () => {
          const response = await executeFunction<{ projects: CloudProject[] }>(config.projectSyncFunctionId, '/projects/list');
          return sortByUpdatedAt(response.projects || []);
        },
        options,
      );
      setProjects(documents);
      return documents;
    } catch (error) {
      setError(key, messageFrom(error, 'Unable to load cloud projects.'));
      return [];
    } finally {
      setBusy(key, false);
    }
  }, [cached, setBusy, setError]);

  const refreshSessions = useCallback(async (options: LoadOptions = {}) => {
    const key = 'sessions';
    setBusy(key, true);
    setError(key, '');
    try {
      const documents = await cached(
        key,
        LIST_TTL_MS,
        async () => {
          const response = await account.listSessions();
          return response.sessions;
        },
        options,
      );
      setSessions(documents);
      return documents;
    } catch (error) {
      setError(key, messageFrom(error, 'Unable to load active sessions.'));
      return [];
    } finally {
      setBusy(key, false);
    }
  }, [cached, setBusy, setError]);

  const refreshDashboard = useCallback(async (options: LoadOptions = {}) => {
    await Promise.all([
      refreshBoards(options),
      refreshAgent(options),
      refreshProjects(options),
    ]);
  }, [refreshAgent, refreshBoards, refreshProjects]);

  const listFirmware = useCallback((boardId: string, options: LoadOptions = {}) => {
    return cached(
      `firmware:${boardId}`,
      DETAIL_TTL_MS,
      async () => {
        const response = await databases.listDocuments<FirmwareDocument>(config.databaseId, config.firmwareCollectionId, [
          Query.equal('boardId', boardId),
          Query.limit(100),
          Query.orderDesc('uploadedAt'),
        ]);
        return sortFirmware(response.documents);
      },
      options,
    );
  }, [cached]);

  const listProjectDevices = useCallback((projectId: string, options: LoadOptions = {}) => {
    return cached(
      `project-devices:${projectId}`,
      DETAIL_TTL_MS,
      async () => {
        const response = await databases.listDocuments<CloudProjectDevice>(config.databaseId, config.cloudProjectDevicesCollectionId, [
          Query.equal('projectId', projectId),
          Query.limit(100),
          Query.orderDesc('updatedAt'),
        ]);
        return sortByUpdatedAt(response.documents);
      },
      options,
    );
  }, [cached]);

  const listProjectEvents = useCallback((projectId: string, options: LoadOptions = {}) => {
    return cached(
      `project-events:${projectId}`,
      DETAIL_TTL_MS,
      async () => {
        const response = await databases.listDocuments<CloudProjectSyncEvent>(config.databaseId, config.cloudProjectSyncEventsCollectionId, [
          Query.equal('projectId', projectId),
          Query.limit(100),
          Query.orderDesc('createdAt'),
        ]);
        return response.documents;
      },
      options,
    );
  }, [cached]);

  const listThreadMessages = useCallback((threadId: string, options: LoadOptions = {}) => {
    return cached(
      `thread-messages:${threadId}`,
      DETAIL_TTL_MS,
      async () => executeFunction<AgentThreadMessage[]>(config.agentSettingsFunctionId, '/threads/messages', { threadId }),
      options,
    );
  }, [cached]);

  const clearCachedDetail = useCallback((prefix: string) => {
    for (const key of Object.keys(detailCacheRef.current)) {
      if (key.startsWith(prefix)) {
        delete detailCacheRef.current[key];
        delete loadedAtRef.current[key];
      }
    }
  }, []);

  useEffect(() => {
    void refreshDashboard();
    void refreshSessions();

    const timer = window.setInterval(() => {
      void refreshDashboard();
    }, FALLBACK_REFRESH_MS);

    return () => window.clearInterval(timer);
  }, [refreshDashboard, refreshSessions]);

  useEffect(() => {
    const channels = [
      collectionChannel(config.boardsCollectionId),
      collectionChannel(config.firmwareCollectionId),
      collectionChannel(config.cloudProjectsCollectionId),
      collectionChannel(config.cloudProjectDevicesCollectionId),
      collectionChannel(config.cloudProjectSyncEventsCollectionId),
    ].filter(Boolean);

    const unsubscribe = subscribe<RealtimeEvent>(channels, (event) => {
      const channels = event.channels || [];
      const payload = isRecord(event.payload) ? event.payload : null;
      const action = eventAction(event);

      if (channels.some((channel) => channel.includes(`collections.${config.boardsCollectionId}`))) {
        delete detailCacheRef.current.boards;
        delete loadedAtRef.current.boards;
        if (payload && typeof payload.$id === 'string') {
          setBoards((current) => {
            if (action === 'delete') {
              return current.filter((board) => board.$id !== payload.$id);
            }
            const next = current.filter((board) => board.$id !== payload.$id);
            next.push(payload as BoardDocument);
            return sortBoards(next);
          });
        } else {
          void refreshBoards({ force: true });
        }
      }

      if (channels.some((channel) => channel.includes(`collections.${config.firmwareCollectionId}`))) {
        const boardId = typeof payload?.boardId === 'string' ? payload.boardId : '';
        clearCachedDetail(boardId ? `firmware:${boardId}` : 'firmware:');
      }

      if (channels.some((channel) => channel.includes(`collections.${config.cloudProjectsCollectionId}`))) {
        delete detailCacheRef.current.projects;
        delete loadedAtRef.current.projects;
        void refreshProjects({ force: true });
      }

      if (channels.some((channel) => channel.includes(`collections.${config.cloudProjectDevicesCollectionId}`))) {
        const projectId = typeof payload?.projectId === 'string' ? payload.projectId : '';
        clearCachedDetail(projectId ? `project-devices:${projectId}` : 'project-devices:');
      }

      if (channels.some((channel) => channel.includes(`collections.${config.cloudProjectSyncEventsCollectionId}`))) {
        const projectId = typeof payload?.projectId === 'string' ? payload.projectId : '';
        clearCachedDetail(projectId ? `project-events:${projectId}` : 'project-events:');
        delete detailCacheRef.current.projects;
        void refreshProjects({ force: true });
      }
    });

    return () => unsubscribe();
  }, [clearCachedDetail, refreshBoards, refreshProjects]);

  const value = useMemo<PortalDataContextValue>(() => ({
    user,
    boards,
    agent,
    projects,
    sessions,
    loading,
    errors,
    refreshDashboard,
    refreshBoards,
    refreshAgent,
    refreshProjects,
    refreshSessions,
    listFirmware,
    listProjectDevices,
    listProjectEvents,
    listThreadMessages,
    clearCachedDetail,
  }), [
    agent,
    boards,
    clearCachedDetail,
    errors,
    listFirmware,
    listProjectDevices,
    listProjectEvents,
    listThreadMessages,
    loading,
    projects,
    refreshAgent,
    refreshBoards,
    refreshDashboard,
    refreshProjects,
    refreshSessions,
    sessions,
    user,
  ]);

  return <PortalDataContext.Provider value={value}>{children}</PortalDataContext.Provider>;
}

export function usePortalData() {
  const context = useContext(PortalDataContext);
  if (!context) {
    throw new Error('usePortalData must be used inside PortalDataProvider.');
  }
  return context;
}
