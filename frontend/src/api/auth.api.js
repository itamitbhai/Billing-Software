import apiClient from './client';

export const authApi = {
  login: async (email, password) => {
    const { data } = await apiClient.post('/auth/login', { email, password });
    return data;
  },

  registerCeo: async ({ companyName, name, email, password }) => {
    const { data } = await apiClient.post('/auth/register-ceo', { companyName, name, email, password });
    return data;
  },

  registerEmployee: async ({ name, email, password, role }) => {
    const { data } = await apiClient.post('/auth/register-employee', { name, email, password, role });
    return data;
  },

  listUsers: async () => {
    const { data } = await apiClient.get('/auth/users');
    return data;
  },

  logout: async (refreshToken) => {
    const { data } = await apiClient.post('/auth/logout', { refreshToken });
    return data;
  },

  getMe: async () => {
    const { data } = await apiClient.get('/auth/me');
    return data;
  }
};
