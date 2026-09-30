import { api } from './client';

export interface LoginResponse {
  access_token: string;
  role: string;
}

const TOKEN_KEY = 'auth_token';
const ROLE_KEY = 'auth_role';

export const authApi = {
  login: (username: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { username, password }),
  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
  },
  saveSession: (token: string, role: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(ROLE_KEY, role);
  },
  getRole: () => localStorage.getItem(ROLE_KEY),
};
