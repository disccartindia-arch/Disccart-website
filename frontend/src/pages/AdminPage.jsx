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
  Dialog, DialogContent, DialogHeader, DialogTitle
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
  
  const [showCouponDialog, setShowCouponDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  
  const [editingItem, setEditingItem] = useState(null);
  const fileInputRef = useRef(null);
  const [uploadStatus, setUploadStatus] = useState(null);

  useEffect(() => {
    if (isAdmin) { fetchData(); }
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
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }

  if (!isAuthenticated || !isAdmin) {
    return <Navigate to="/login" replace />;
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadStatus({ loading: true, message: 'Uploading...' });
    try {
      await bulkUploadCoupons(file);
      setUploadStatus({ loading: false, success: true, message: 'Upload Successful' });
      toast.success('Deals uploaded');
      fetchData();
    } catch (err) {
      setUploadStatus({ loading: false, success: false, message: 'Upload Failed' });
    }
  };

  const handleDelete = async (type, id, name) => {
    if (!window.confirm(`Delete ${name}?`)) return;
    try {
      if (type === 'coupon') await deleteCoupon(id);
      if (type === 'category') await deleteCategory(id);
      toast.success('Deleted');
      fetchData();
    } catch { toast.error('Delete failed'); }
  };

  return (
    <div className="pb-20 md:pb-8">
      <AdminSEO />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold mb-8">Admin Panel</h1>
        
        {/* Tab Navigation */}
        <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
          {['dashboard', 'coupons', 'categories', 'upload'].map((tab) => (
            <Button 
              key={tab} 
              variant={activeTab === tab ? 'default' : 'outline'}
              onClick={() => setActiveTab(tab)}
              className="capitalize"
            >
              {tab}
            </Button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {activeTab === 'dashboard' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-white border rounded-xl">
                <p className="text-sm text-gray-500">Total Deals</p>
                <p className="text-3xl font-bold">{analytics?.total_coupons || 0}</p>
              </div>
              <div className="p-6 bg-white border rounded-xl">
                <p className="text-sm text-gray-500">Active Deals</p>
                <p className="text-3xl font-bold text-green-600">{analytics?.active_coupons || 0}</p>
              </div>
              <div className="p-6 bg-white border rounded-xl">
                <p className="text-sm text-gray-500">Total Clicks</p>
                <p className="text-3xl font-bold text-orange-500">{analytics?.total_clicks || 0}</p>
              </div>
            </motion.div>
          )}

          {activeTab === 'coupons' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Manage Deals</h2>
                <Button onClick={() => { setEditingItem(null); setShowCouponDialog(true); }}>Add Deal</Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.title}</TableCell>
                      <TableCell>{c.brand_name}</TableCell>
                      <TableCell>₹{c.discounted_price || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" onClick={() => { setEditingItem(c); setShowCouponDialog(true); }}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" className="text-red-500" onClick={() => handleDelete('coupon', c.id, c.title)}><Trash2 className="w-4 h-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="max-w-xl mx-auto p-8 border-2 border-dashed rounded-2xl text-center">
              <Upload className="mx-auto w-12 h-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-bold">Bulk Upload CSV</h3>
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
              <Button className="mt-4" onClick={() => fileInputRef.current.click()}>Select File</Button>
              {uploadStatus && <p className="mt-4 text-sm">{uploadStatus.message}</p>}
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={showCouponDialog} onOpenChange={setShowCouponDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingItem ? 'Edit' : 'Add'} Deal</DialogTitle></DialogHeader>
          <CouponForm item={editingItem} categories={categories} onSuccess={() => { setShowCouponDialog(false); fetchData(); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CouponForm({ item, categories, onSuccess }) {
  const [form, setForm] = useState(item || { title: '', brand_name: '', category_name: '', original_price: '', discounted_price: '', affiliate_url: '' });
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (item) await updateCoupon(item.id, form);
      else await createCoupon(form);
      toast.success('Saved');
      onSuccess();
    } catch { toast.error('Save failed'); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input placeholder="Title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required />
      <div className="grid grid-cols-2 gap-4">
        <Input type="number" placeholder="Original Price" value={form.original_price} onChange={e => setForm({...form, original_price: e.target.value})} />
        <Input type="number" placeholder="Discounted Price" value={form.discounted_price} onChange={e => setForm({...form, discounted_price: e.target.value})} />
      </div>
      <Input placeholder="Brand" value={form.brand_name} onChange={e => setForm({...form, brand_name: e.target.value})} required />
      <select 
        className="w-full p-2 border rounded-md" 
        value={form.category_name} 
        onChange={e => setForm({...form, category_name: e.target.value})}
      >
        <option value="">Select Category</option>
        {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
      </select>
      <Input placeholder="Affiliate URL" value={form.affiliate_url} onChange={e => setForm({...form, affiliate_url: e.target.value})} required />
      <Button type="submit" className="w-full">Save Deal</Button>
    </form>
  );
}
