import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  token: localStorage.getItem('token') || null,
  refreshToken: localStorage.getItem('refreshToken') || null,
  user: JSON.parse(localStorage.getItem('user')) || null,
  isAuthenticated: !!localStorage.getItem('token'),

  setAuth: (token, refreshToken, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    set({ token, refreshToken, user, isAuthenticated: true });
  },

  clearAuth: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    set({ token: null, refreshToken: null, user: null, isAuthenticated: false });
  },

  updateUser: (updatedFields) => {
    set((state) => {
      const newUser = state.user ? { ...state.user, ...updatedFields } : null;
      if (newUser) {
        localStorage.setItem('user', JSON.stringify(newUser));
      }
      return { user: newUser };
    });
  }
}));
