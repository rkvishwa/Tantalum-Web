'use client';

import type { Models } from 'appwrite';
import { account, functions } from './appwrite';
import { config } from './config';

export type FunctionEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

type ExecutionLike = Models.Execution & {
  response?: string;
  responseBody?: string;
  responseStatusCode?: number;
  statusCode?: number;
};

function responseBody(execution: ExecutionLike) {
  if (typeof execution.responseBody === 'string' && execution.responseBody.length > 0) {
    return execution.responseBody;
  }

  if (typeof execution.response === 'string') {
    return execution.response;
  }

  return typeof execution.responseBody === 'string' ? execution.responseBody : '';
}

let jwtCache: { jwt: string; expiresAt: number } | null = null;

function attachJwt(headers: Record<string, string>, jwt: string) {
  headers.authorization = `Bearer ${jwt}`;
  headers['x-tantalum-user-jwt'] = jwt;
}

async function executionAuth() {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const now = Date.now();
  if (jwtCache && jwtCache.expiresAt > now) {
    attachJwt(headers, jwtCache.jwt);
    return { headers, jwt: jwtCache.jwt };
  }

  try {
    const token = await account.createJWT();
    jwtCache = {
      jwt: token.jwt,
      expiresAt: now + 10 * 60 * 1000,
    };
    attachJwt(headers, token.jwt);
  } catch {
    jwtCache = null;
  }

  return { headers, jwt: jwtCache?.jwt };
}

export async function executeFunction<T>(functionId: string, path: string, payload: Record<string, unknown> = {}) {
  if (functionId === config.webAdminFunctionId) {
    const execution = await functions.createExecution(
      functionId,
      JSON.stringify(payload),
      false,
      path,
      'POST',
      { 'content-type': 'application/json' },
    ) as ExecutionLike;

    const body = responseBody(execution);
    const parsed = JSON.parse(body || '{"ok":false,"error":"Function returned an empty response."}') as FunctionEnvelope<T>;
    const statusCode = Number(execution.responseStatusCode ?? execution.statusCode ?? 0);
    if (statusCode >= 400 || !parsed.ok || parsed.data === undefined) {
      throw new Error(parsed.error || 'Function execution failed.');
    }

    return parsed.data;
  }

  const auth = await executionAuth();

  const execution = await functions.createExecution(
    functionId,
    JSON.stringify(payload),
    false,
    path,
    'POST',
    auth.headers,
  ) as ExecutionLike;

  const body = responseBody(execution);
  const parsed = JSON.parse(body || '{"ok":false,"error":"Function returned an empty response."}') as FunctionEnvelope<T>;
  const statusCode = Number(execution.responseStatusCode ?? execution.statusCode ?? 0);
  if (statusCode >= 400 || !parsed.ok || parsed.data === undefined) {
    throw new Error(parsed.error || 'Function execution failed.');
  }

  return parsed.data;
}
