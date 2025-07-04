import type { User, LoginCredentials, RegisterCredentials } from '../types/auth';

const API_BASE_URL = '';

async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`/api${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

export async function registerUser(credentials: RegisterCredentials): Promise<User> {
  const data = await apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: credentials.name,
      email: credentials.email,
      password: credentials.password
    }),
  });

  return data.user;
}

export async function loginUser(credentials: LoginCredentials): Promise<User> {
  const data = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: credentials.email,
      password: credentials.password,
    }),
  });

  return data.user;
}

export async function checkServerHealth() {
  try {
    const data = await apiRequest('/health');
    return data;
  } catch (error) {
    console.error('Server health check failed:', error);
    throw error;
  }
}