import axios from 'axios';
export const BASE = process.env.REACT_APP_BACKEND_URL;
export const api = axios.create({ baseURL: `${BASE}/api`, withCredentials: true });
export const errorText = (error) => {
  const d = error.response?.data?.detail;
  return typeof d === 'string' ? d : Array.isArray(d) ? d.map(x => x.msg).join('. ') : 'Something went wrong. Please try again.';
};
let refreshing;
api.interceptors.response.use(r => r, async error => {
  const original = error.config;
  if (error.response?.status === 401 && original && !original._retry && !original.url.startsWith('/auth/')) {
    original._retry = true;
    try {
      if (!refreshing) refreshing = api.post('/auth/refresh').finally(() => { refreshing = null; });
      await refreshing;
      return api(original);
    } catch (_) { /* Sign-in screen handles expired sessions. */ }
  }
  return Promise.reject(error);
});
export const imgUrl = (url, width=1000) => url?.includes('images.unsplash.com') ? url.replace(/w=\d+/, `w=${width}`) : url;
export const newId = () => crypto.randomUUID();
export const slugify = text => text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');