import { handleMockRequest } from './mockAdapter.js';

const envMeta = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};

export const API_BASE_URL = envMeta.VITE_API_URL || '/api';
export const USE_MOCKS = String(envMeta.VITE_USE_MOCKS || 'false').toLowerCase() === 'true';

let accessToken = null;

if (typeof window !== 'undefined' && window.localStorage) {
  try {
    window.localStorage.removeItem('reddit_clone_token');
  } catch (err) {
    if (err?.name !== 'SecurityError') throw err;
  }
}

export function setAccessToken(token) {
  accessToken = token || null;
}

export class ApiClientError extends Error {
  constructor(message, { statusCode = 500, code = 'INTERNAL_ERROR', details = [] } = {}) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function buildUrl(path, params) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  const url = new URL(`${baseUrl}${cleanPath}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        url.searchParams.set(key, String(val));
      }
    });
  }
  return url.toString();
}

export async function apiRequest(path, { method = 'GET', params, body, headers = {} } = {}) {
  if (USE_MOCKS) {
    const queryString = params ? `?${new URLSearchParams(params).toString()}` : '';
    return handleMockRequest(`${path}${queryString}`, { method, body });
  }

  const url = buildUrl(path, params);

  const requestHeaders = {
    Accept: 'application/json',
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...headers,
  };

  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.success === false) {
    const apiErr = payload?.error || {};
    throw new ApiClientError(apiErr.message || `Request failed with status ${response.status}`, {
      statusCode: response.status,
      code: apiErr.code || 'INTERNAL_ERROR',
      details: apiErr.details || [],
    });
  }

  return payload;
}
