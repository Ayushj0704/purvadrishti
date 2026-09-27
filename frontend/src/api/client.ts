export class ApiError extends Error {
  status: number; constructor(status: number, message: string) {
    super(message); this.status = status;
    this.name = 'ApiError';
  }
}

const BASE_URL = '/api';

async function fetchClient<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('auth_token');
  const headers = new Headers(options.headers || {});
  
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = 'An error occurred';
    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || errorMessage;
    } catch {
      errorMessage = response.statusText;
    }
    throw new ApiError(response.status, errorMessage);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const api = {
  get: <T>(endpoint: string) => fetchClient<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body?: any) => 
    fetchClient<T>(endpoint, { 
      method: 'POST', 
      body: body ? JSON.stringify(body) : undefined 
    }),
  put: <T>(endpoint: string, body?: any) => 
    fetchClient<T>(endpoint, { 
      method: 'PUT', 
      body: body ? JSON.stringify(body) : undefined 
    }),
  delete: <T>(endpoint: string) => fetchClient<T>(endpoint, { method: 'DELETE' }),
};
