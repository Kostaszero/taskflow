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
};

export const tasks = {
  list: (projectId: string, status?: string, assignee?: string) =>
    api.get(`/projects/${projectId}/tasks`, { params: { status, assignee } }),
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
