import { writable } from 'svelte/store';
import type { User } from '../types/auth';

export const user = writable<User | null>(null);
export const isAuthenticated = writable<boolean>(false);
export const isLoading = writable<boolean>(false);

if (typeof window !== 'undefined') {
  const storedUser = localStorage.getItem('user');
  if (storedUser) {
    try {
      const userData = JSON.parse(storedUser);
      user.set(userData);
      isAuthenticated.set(true);
    } catch (error) {
      localStorage.removeItem('user');
    }
  }
}

export function setUser(userData: User | null) {
  user.set(userData);
  isAuthenticated.set(!!userData);
  
  if (userData) {
    localStorage.setItem('user', JSON.stringify(userData));
  } else {
    localStorage.removeItem('user');
  }
}

export function logout() {
  setUser(null);
}