import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Create axios instance with credentials
const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If 401 and not already retrying, try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        await axios.post(`${API_URL}/api/auth/refresh`, {}, { withCredentials: true });
        return api(originalRequest);
      } catch {
        // Refresh failed, redirect to login
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

// Coupons
export const getCoupons = async (params = {}) => {
  const { data } = await api.get('/coupons', { params });
  return data;
};

export const getCoupon = async (id) => {
  const { data } = await api.get(`/coupons/${id}`);
  return data;
};

export const createCoupon = async (couponData) => {
  const { data } = await api.post('/coupons', couponData);
  return data;
};

export const updateCoupon = async (id, couponData) => {
  const { data } = await api.put(`/coupons/${id}`, couponData);
  return data;
};

export const deleteCoupon = async (id) => {
  const { data } = await api.delete(`/coupons/${id}`);
  return data;
};

export const bulkUploadCoupons = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/coupons/bulk-upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return data;
};

// Categories
export const getCategories = async () => {
  const { data } = await api.get('/categories');
  return data;
};

export const createCategory = async (categoryData) => {
  const { data } = await api.post('/categories', categoryData);
  return data;
};

// Brands
export const getBrands = async () => {
  const { data } = await api.get('/brands');
  return data;
};

export const createBrand = async (brandData) => {
  const { data } = await api.post('/brands', brandData);
  return data;
};

// Click tracking
export const trackClick = async (couponId, source = 'web') => {
  const { data } = await api.post('/clicks', { coupon_id: couponId, source });
  return data;
};

// Analytics
export const getAnalyticsOverview = async () => {
  const { data } = await api.get('/analytics/overview');
  return data;
};

export const getClickAnalytics = async (days = 7) => {
  const { data } = await api.get('/analytics/clicks', { params: { days } });
  return data;
};

// SEO Pages
export const getSeoPageData = async (pageType) => {
  const { data } = await api.get(`/seo/${pageType}`);
  return data;
};

// AI Content
export const generateAIContent = async (contentData) => {
  const { data } = await api.post('/ai/generate-content', contentData);
  return data;
};

export default api;
