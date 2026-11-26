import {
  API_BASE_URL,
  USE_MOCKS,
  apiRequest,
  getStoredToken,
  setStoredToken,
} from './httpClient.js';

export { API_BASE_URL, USE_MOCKS, apiRequest, getStoredToken, setStoredToken };

export const api = {
  health: {
    check: () => apiRequest('/health'),
  },
  auth: {
    register: (payload) => apiRequest('/auth/register', { method: 'POST', body: payload }),
    login: (payload) => apiRequest('/auth/login', { method: 'POST', body: payload }),
    me: () => apiRequest('/auth/me'),
    logout: () => apiRequest('/auth/logout', { method: 'POST' }),
  },
  users: {
    getProfile: (username) => apiRequest(`/users/${encodeURIComponent(username)}`),
    updateMe: (payload) => apiRequest('/users/me', { method: 'PATCH', body: payload }),
    listPosts: (username, params) =>
      apiRequest(`/users/${encodeURIComponent(username)}/posts`, { params }),
    listComments: (username, params) =>
      apiRequest(`/users/${encodeURIComponent(username)}/comments`, { params }),
  },
  communities: {
    list: (params) => apiRequest('/communities', { params }),
    create: (payload) => apiRequest('/communities', { method: 'POST', body: payload }),
    getByName: (name) => apiRequest(`/communities/${encodeURIComponent(name)}`),
    update: (name, payload) =>
      apiRequest(`/communities/${encodeURIComponent(name)}`, { method: 'PATCH', body: payload }),
    join: (name) => apiRequest(`/communities/${encodeURIComponent(name)}/join`, { method: 'POST' }),
    leave: (name) =>
      apiRequest(`/communities/${encodeURIComponent(name)}/leave`, { method: 'POST' }),
    listPosts: (name, params) =>
      apiRequest(`/communities/${encodeURIComponent(name)}/posts`, { params }),
    createPost: (name, payload) =>
      apiRequest(`/communities/${encodeURIComponent(name)}/posts`, {
        method: 'POST',
        body: payload,
      }),
  },
  feed: {
    home: (params) => apiRequest('/feed', { params }),
    popular: (params) => apiRequest('/posts', { params }),
  },
  posts: {
    getById: (id) => apiRequest(`/posts/${id}`),
    update: (id, payload) => apiRequest(`/posts/${id}`, { method: 'PATCH', body: payload }),
    removeOwn: (id) => apiRequest(`/posts/${id}`, { method: 'DELETE' }),
    moderatorRemove: (id, reason) =>
      apiRequest(`/posts/${id}/remove`, { method: 'POST', body: reason ? { reason } : {} }),
    vote: (id, value) => apiRequest(`/posts/${id}/vote`, { method: 'PUT', body: { value } }),
    summarize: (id) => apiRequest(`/posts/${id}/summary`, { method: 'POST' }),
  },
  comments: {
    listByPost: (postId, params) => apiRequest(`/posts/${postId}/comments`, { params }),
    create: (postId, payload) =>
      apiRequest(`/posts/${postId}/comments`, { method: 'POST', body: payload }),
    update: (id, content) => apiRequest(`/comments/${id}`, { method: 'PATCH', body: { content } }),
    removeOwn: (id) => apiRequest(`/comments/${id}`, { method: 'DELETE' }),
    moderatorRemove: (id, reason) =>
      apiRequest(`/comments/${id}/remove`, { method: 'POST', body: reason ? { reason } : {} }),
    vote: (id, value) => apiRequest(`/comments/${id}/vote`, { method: 'PUT', body: { value } }),
  },
  search: {
    query: (params) => apiRequest('/search', { params }),
  },
};

export default api;
