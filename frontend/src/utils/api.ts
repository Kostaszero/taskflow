import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    throw error;
  }
);

const toReadableLabel = (value: string) =>
  value
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const getApiErrorMessage = (error: any, fallback = 'Something went wrong') => {
  const data = error?.response?.data;

  if (data?.fields && typeof data.fields === 'object') {
    const fieldMessages = Object.entries(data.fields)
      .filter(([, message]) => typeof message === 'string' && message.trim().length > 0)
      .map(([field, message]) => `${toReadableLabel(field)} ${String(message).trim()}`);

    if (fieldMessages.length > 0) {
      return fieldMessages.join('. ');
    }
  }

  if (typeof data?.error === 'string' && data.error.trim().length > 0) {
    return data.error;
  }

  return fallback;
};

export interface AuthResponse {
  token: string;
  user: { id: string; name: string; email: string };
}

export const auth = {
  register: (name: string, email: string, password: string) =>
    api.post<AuthResponse>('/auth/register', { name, email, password }),
  
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }),
};

export const projects = {
  list: () => api.get('/projects'),
  create: (name: string, description?: string) =>
    api.post('/projects', { name, description }),
  get: (id: string) => api.get(`/projects/${id}`),
  update: (id: string, name?: string, description?: string) =>
    api.patch(`/projects/${id}`, { name, description }),
  delete: (id: string) => api.delete(`/projects/${id}`),
  stats: (id: string) => api.get(`/projects/${id}/stats`),
};

export const users = {
  list: () => api.get('/users'),
  search: (q: string, limit = 10) => api.get('/users/search', { params: { q, limit } }),
};

export const tasks = {
  list: (projectId: string, status?: string, assignee?: string) =>
    api.get(`/projects/${projectId}/tasks`, { params: { status, assignee } }),
  get: (projectId: string, taskId: string) => api.get(`/projects/${projectId}/tasks/${taskId}`),
  create: (projectId: string, title: string, description?: string, priority?: string, assignee_id?: string, due_date?: string) =>
    api.post(`/projects/${projectId}/tasks`, { title, description, priority, assignee_id, due_date }),
  update: (id: string, updates: any) =>
    api.patch(`/tasks/${id}`, updates),
  delete: (id: string) => api.delete(`/tasks/${id}`),
};

export const useAuth = () => {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null;
  const isAuthenticated = !!token && !!user;

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return { token, user, isAuthenticated, logout };
};
