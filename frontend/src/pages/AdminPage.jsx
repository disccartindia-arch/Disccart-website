import { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Tag, Upload, Link2, FileText, BookOpen,
  Plus, Pencil, Trash2, Check, X, Loader2, FileSpreadsheet, 
  AlertCircle, ExternalLink, Copy, Eye
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '../components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../components/ui/select';
import {
  getCoupons, createCoupon, updateCoupon, deleteCoupon,
  bulkUploadCoupons, getAnalyticsOverview, getCategories,
  createCategory, updateCategory, deleteCategory,
  getPrettyLinks, createPrettyLink, updatePrettyLink, deletePrettyLink,
  getPages, createPage, updatePage, deletePage,
  getBlogPosts, createBlogPost, updateBlogPost, deleteBlogPost
} from '../lib/api';
import { AdminSEO } from '../components/SEO';

export default function AdminPage() {
  const { isAuthenticated, isAdmin, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [coupons, setCoupons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [prettyLinks, setPrettyLinks] = useState([]);
  const [pages, setPages] = useState([]);
  const [blogPosts, setBlogPosts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [showCouponDialog, setShowCouponDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showPageDialog, setShowPageDialog] = useState(false);
  const [showBlogDialog, setShowBlogDialog] = useState(false);
  
  // Editing states
  const [editingItem, setEditingItem] = useState(null);
  
  const fileInputRef = useRef(null);
  const [uploadStatus, setUploadStatus] = useState(null);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [couponsData, analyticsData, categoriesData, linksData, pagesData, blogData] = await Promise.all([
        getCoupons({ limit: 100 }),
        getAnalyticsOverview().catch(() => null),
        getCategories(),
        getPrettyLinks().catch(() => []),
        getPages().catch(() => []),
        getBlogPosts(false).catch(() => [])
      ]);
      setCoupons(couponsData);
      setAnalytics(analyticsData);
      setCategories(categoriesData);
      setPrettyLinks(linksData);
      setPages(pagesData);
      setBlogPosts(blogData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#ee922c] animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return <Navigate to="/login" replace />;
  }

  // File upload handler
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadStatus({ loading: true, message: 'Uploading...' });
    try {
      const result = await bulkUploadCoupons(file);
      setUploadStatus({ loading: false, success: true, message: `Successfully added coupons` });
      toast.success(`Coupons uploaded successfully`);
      fetchData();
    } catch (error) {
      setUploadStatus({ loading: false, success: false, message: 'Upload failed' });
      toast.error('Upload failed');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (type, id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try {
      if (type === 'coupon') await deleteCoupon(id);
      else if (type === 'category') await deleteCategory(id);
      else if (type === 'link') await deletePrettyLink(id);
      else if (type === 'page') await deletePage(id);
      else if (type === 'blog') await deleteBlogPost(id);
      toast.success('Deleted successfully');
      fetchData();
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'coupons', label: 'Deals', icon: Tag },
    { id: 'categories', label: 'Categories', icon: Tag },
    { id: 'links', label: 'Pretty Links', icon: Link2 },
    { id: 'pages', label: 'Pages', icon: FileText },
    { id: 'blog', label: 'Blog', icon: BookOpen },
    { id: 'upload', label: 'CSV Upload', icon: Upload }
  ];

  return (
    <div className="pb-20 md:pb-8" data-testid="admin-page">
      <AdminSEO />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display font-bold text-3xl text-gray-900">Admin Panel</h1>
            <p className="text-gray-500">Manage your DISCCART platform</p>
          </div>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto hide-scrollbar pb-2">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm whitespace-nowrap transition-all ${
                activeTab === id ? 'bg-[#ee922c] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-[#ee922c]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'dashboard' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6"></motion.div>
          