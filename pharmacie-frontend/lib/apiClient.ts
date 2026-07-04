import axios from 'axios';

function resolveApiUrl(): string {  
  if (process.env.NEXT_PUBLIC_API_URL) 
    { return process.env.NEXT_PUBLIC_API_URL; }  
  if (typeof window !== 'undefined') { 
    const port = process.env.NEXT_PUBLIC_API_PORT || '8000'; 
    return `${window.location.protocol}//${window.location.hostname}:${port}`;  
  } 
  return 'http://localhost:8000'; 
} 
const API_URL = resolveApiUrl();

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;

      if (!refreshToken) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      try {
        const res = await axios.post(`${API_URL}/api/token/refresh/`, { refresh: refreshToken });

        if (res.status === 200) {
          localStorage.setItem('access_token', res.data.access);
          originalRequest.headers.Authorization = `Bearer ${res.data.access}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          localStorage.clear();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
