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

export const getCategory = async (id) => {
  const { data } = await api.get(`/categories/${id}`);
  return data;
};

export const createCategory = async (categoryData) => {
  const { data } = await api.post('/categories', categoryData);
  return data;
};

export const updateCategory = async (id, categoryData) => {
  const { data } = await api.put(`/categories/${id}`, categoryData);
  return data;
};

export const deleteCategory = async (id) => {
  const { data } = await api.delete(`/categories/${id}`);
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

// Pretty Links
export const getPrettyLinks = async () => {
  const { data } = await api.get('/pretty-links');
  return data;
};

export const createPrettyLink = async (linkData) => {
  const { data } = await api.post('/pretty-links', linkData);
  return data;
};

export const updatePrettyLink = async (id, linkData) => {
  const { data } = await api.put(`/pretty-links/${id}`, linkData);
  return data;
};

export const deletePrettyLink = async (id) => {
  const { data } = await api.delete(`/pretty-links/${id}`);
  return data;
};

// Pages (CMS)
export const getPages = async (publishedOnly = false) => {
  const { data } = await api.get('/pages', { params: { published_only: publishedOnly } });
  return data;
};

export const getPage = async (slug) => {
  const { data } = await api.get(`/pages/${slug}`);
  return data;
};

export const createPage = async (pageData) => {
  const { data } = await api.post('/pages', pageData);
  return data;
};

export const updatePage = async (id, pageData) => {
  const { data } = await api.put(`/pages/${id}`, pageData);
  return data;
};

export const deletePage = async (id) => {
  const { data } = await api.delete(`/pages/${id}`);
  return data;
};

// Blog
export const getBlogPosts = async (publishedOnly = true, limit = 20, skip = 0) => {
  const { data } = await api.get('/blog', { params: { published_only: publishedOnly, limit, skip } });
  return data;
};

export const getBlogPost = async (slug) => {
  const { data } = await api.get(`/blog/${slug}`);
  return data;
};

export const createBlogPost = async (postData) => {
  const { data } = await api.post('/blog', postData);
  return data;
};

export const updateBlogPost = async (id, postData) => {
  const { data } = await api.put(`/blog/${id}`, postData);
  return data;
};

export const deleteBlogPost = async (id) => {
  const { data } = await api.delete(`/blog/${id}`);
  return data;
};

export default api;
