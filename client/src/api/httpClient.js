import { handleMockRequest } from './mockAdapter.js';

const envMeta = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};

export const API_BASE_URL = envMeta.VITE_API_URL || 'http://localhost:5000/api';
export const USE_MOCKS = String(envMeta.VITE_USE_MOCKS || 'false').toLowerCase() === 'true';

const TOKEN_STORAGE_KEY = 'reddit_clone_token';

export function getStoredToken() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  if (token) {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
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
  const url = new URL(`${API_BASE_URL}${cleanPath}`);
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
  const token = getStoredToken();

  const requestHeaders = {
    Accept: 'application/json',
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };

  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
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
