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

  // Add Category Function
const handleAddCategory = async (e) => {
  e.preventDefault();
  await axios.post('https://disccart-api.onrender.com/api/categories', newCategoryData, { withCredentials: true });
  alert("Category Added!");
};

// Delete Category Function
const handleDeleteCategory = async (categoryId) => {
  if(window.confirm("Are you sure?")) {
    await axios.delete(`https://disccart-api.onrender.com/api/categories/${categoryId}`, { withCredentials: true });
    // Refresh your list here
  }
};

  const fetchData = async () => {
    setLoading(true);
    try {
      const [couponsData, analyticsData, categoriesData, linksData, pagesData, blogData] = await Promise.all([
        getCoupons({ limit: 100 }),
        getAnalyticsOverview(),
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
      setUploadStatus({ loading: false, success: true, message: `Added ${result.added} coupons`, errors: result.errors });
      toast.success(`${result.added} coupons added`);
      fetchData();
    } catch (error) {
      setUploadStatus({ loading: false, success: false, message: error.response?.data?.detail || 'Upload failed' });
      toast.error('Upload failed');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Delete handlers
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
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display font-bold text-3xl text-gray-900">Admin Panel</h1>
            <p className="text-gray-500">Manage your DISCCART platform</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto hide-scrollbar pb-2">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm whitespace-nowrap transition-all ${
                activeTab === id ? 'bg-[#ee922c] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-[#ee922c]'
              }`}
              data-testid={`tab-${id}`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard title="Total Deals" value={analytics?.total_coupons || 0} />
              <StatCard title="Active Deals" value={analytics?.active_coupons || 0} color="green" />
              <StatCard title="Total Clicks" value={analytics?.total_clicks || 0} color="orange" />
              <StatCard title="Pretty Links" value={analytics?.total_pretty_links || 0} />
              <StatCard title="Pages" value={analytics?.total_pages || 0} />
              <StatCard title="Blog Posts" value={analytics?.total_blog_posts || 0} />
              <StatCard title="Users" value={analytics?.total_users || 0} />
              <StatCard title="Recent Clicks (7d)" value={analytics?.recent_clicks || 0} color="orange" />
            </div>

            {/* Top Performing */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {analytics?.top_brands?.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Top Brands</h3>
                  <div className="space-y-3">
                    {analytics.top_brands.map((brand, i) => (
                      <div key={brand.name} className="flex items-center gap-4">
                        <span className="w-6 h-6 rounded-full bg-orange-100 text-[#ee922c] text-xs font-bold flex items-center justify-center">{i + 1}</span>
                        <span className="flex-1">{brand.name}</span>
                        <span className="text-gray-500">{brand.clicks} clicks</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analytics?.top_links?.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Top Pretty Links</h3>
                  <div className="space-y-3">
                    {analytics.top_links.map((link, i) => (
                      <div key={link.slug} className="flex items-center gap-4">
                        <span className="w-6 h-6 rounded-full bg-green-100 text-[#3c7b48] text-xs font-bold flex items-center justify-center">{i + 1}</span>
                        <span className="flex-1">/go/{link.slug}</span>
                        <span className="text-gray-500">{link.clicks} clicks</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Coupons Tab */}
        {activeTab === 'coupons' && (
          <DataTable
            title="Deals & Coupons"
            data={coupons}
            columns={[
              { key: 'title', label: 'Title', render: (v) => <span className="font-medium truncate max-w-[200px] block">{v}</span> },
              { key: 'brand_name', label: 'Brand' },
              { key: 'code', label: 'Code', render: (v) => v ? <code className="bg-gray-100 px-2 py-1 rounded text-sm">{v}</code> : '-' },
              { key: 'clicks', label: 'Clicks' },
              { key: 'is_active', label: 'Status', render: (v) => v ? <span className="text-green-600">Active</span> : <span className="text-gray-400">Inactive</span> }
            ]}
            onAdd={() => { setEditingItem(null); setShowCouponDialog(true); }}
            onEdit={(item) => { setEditingItem(item); setShowCouponDialog(true); }}
            onDelete={(item) => handleDelete('coupon', item.id, item.title)}
            loading={loading}
          />
        )}

        {/* Categories Tab */}
        {activeTab === 'categories' && (
          <DataTable
            title="Categories"
            data={categories}
            columns={[
              { key: 'name', label: 'Name', render: (v) => <span className="font-medium">{v}</span> },
              { key: 'slug', label: 'Slug' },
              { key: 'deal_count', label: 'Deals' },
              { key: 'description', label: 'Description', render: (v) => <span className="truncate max-w-[200px] block">{v || '-'}</span> }
            ]}
            onAdd={() => { setEditingItem(null); setShowCategoryDialog(true); }}
            onEdit={(item) => { setEditingItem(item); setShowCategoryDialog(true); }}
            onDelete={(item) => handleDelete('category', item.id, item.name)}
            loading={loading}
          />
        )}

        {/* Pretty Links Tab */}
        {activeTab === 'links' && (
          <DataTable
            title="Pretty Links (Affiliate URLs)"
            data={prettyLinks}
            columns={[
              { key: 'slug', label: 'Short URL', render: (v) => <code className="text-[#ee922c]">/go/{v}</code> },
              { key: 'title', label: 'Title' },
              { key: 'destination_url', label: 'Destination', render: (v) => <span className="truncate max-w-[200px] block text-sm text-gray-500">{v}</span> },
              { key: 'clicks', label: 'Clicks', render: (v) => <span className="font-bold text-[#3c7b48]">{v}</span> },
              { key: 'is_active', label: 'Status', render: (v) => v ? <span className="text-green-600">Active</span> : <span className="text-gray-400">Inactive</span> }
            ]}
            onAdd={() => { setEditingItem(null); setShowLinkDialog(true); }}
            onEdit={(item) => { setEditingItem(item); setShowLinkDialog(true); }}
            onDelete={(item) => handleDelete('link', item.id, item.slug)}
            loading={loading}
            extraActions={(item) => (
              <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/go/${item.slug}`); toast.success('Link copied!'); }}>
                <Copy className="w-4 h-4" />
              </Button>
            )}
          />
        )}

        {/* Pages Tab */}
        {activeTab === 'pages' && (
          <DataTable
            title="Static Pages"
            data={pages}
            columns={[
              { key: 'title', label: 'Title', render: (v) => <span className="font-medium">{v}</span> },
              { key: 'slug', label: 'URL', render: (v) => <code>/page/{v}</code> },
              { key: 'is_published', label: 'Status', render: (v) => v ? <span className="text-green-600">Published</span> : <span className="text-gray-400">Draft</span> }
            ]}
            onAdd={() => { setEditingItem(null); setShowPageDialog(true); }}
            onEdit={(item) => { setEditingItem(item); setShowPageDialog(true); }}
            onDelete={(item) => handleDelete('page', item.id, item.title)}
            loading={loading}
            extraActions={(item) => (
              <a href={`/page/${item.slug}`} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm"><Eye className="w-4 h-4" /></Button>
              </a>
            )}
          />
        )}

        {/* Blog Tab */}
        {activeTab === 'blog' && (
          <DataTable
            title="Blog Posts"
            data={blogPosts}
            columns={[
              { key: 'title', label: 'Title', render: (v) => <span className="font-medium truncate max-w-[250px] block">{v}</span> },
              { key: 'category', label: 'Category' },
              { key: 'views', label: 'Views' },
              { key: 'is_published', label: 'Status', render: (v) => v ? <span className="text-green-600">Published</span> : <span className="text-gray-400">Draft</span> }
            ]}
            onAdd={() => { setEditingItem(null); setShowBlogDialog(true); }}
            onEdit={(item) => { setEditingItem(item); setShowBlogDialog(true); }}
            onDelete={(item) => handleDelete('blog', item.id, item.title)}
            loading={loading}
            extraActions={(item) => (
              <a href={`/blog/${item.slug}`} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm"><Eye className="w-4 h-4" /></Button>
              </a>
            )}
          />
        )}

        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl border border-gray-200 p-8">
              <div className="text-center mb-8">
                <FileSpreadsheet className="w-16 h-16 text-[#ee922c] mx-auto mb-4" />
                <h2 className="font-display font-bold text-2xl mb-2">Bulk Upload Coupons</h2>
                <p className="text-gray-500">Upload a CSV file to add multiple coupons</p>
              </div>
              <div
                className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-[#ee922c] transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="font-medium">Click to upload CSV</p>
                <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
              </div>
              {uploadStatus && (
                <div className={`mt-6 p-4 rounded-xl ${uploadStatus.loading ? 'bg-blue-50 text-blue-700' : uploadStatus.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  <div className="flex items-center gap-2">
                    {uploadStatus.loading ? <Loader2 className="w-5 h-5 animate-spin" /> : uploadStatus.success ? <Check className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    <span className="font-medium">{uploadStatus.message}</span>
                  </div>
                </div>
              )}
              <div className="mt-8 p-4 bg-gray-50 rounded-xl">
                <h3 className="font-semibold mb-2">CSV Format</h3>
                <code className="block text-xs bg-gray-900 text-green-400 p-3 rounded-lg overflow-x-auto">
                  title,description,code,discount_type,discount_value,brand_name,category_name,affiliate_url
                </code>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Dialogs */}
      <CouponDialog open={showCouponDialog} onOpenChange={setShowCouponDialog} item={editingItem} categories={categories} onSuccess={() => { setShowCouponDialog(false); fetchData(); }} />
      <CategoryDialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog} item={editingItem} onSuccess={() => { setShowCategoryDialog(false); fetchData(); }} />
      <PrettyLinkDialog open={showLinkDialog} onOpenChange={setShowLinkDialog} item={editingItem} onSuccess={() => { setShowLinkDialog(false); fetchData(); }} />
      <PageDialog open={showPageDialog} onOpenChange={setShowPageDialog} item={editingItem} onSuccess={() => { setShowPageDialog(false); fetchData(); }} />
      <BlogDialog open={showBlogDialog} onOpenChange={setShowBlogDialog} item={editingItem} onSuccess={() => { setShowBlogDialog(false); fetchData(); }} />
    </div>
  );
}

// Stat Card Component
function StatCard({ title, value, color = 'default' }) {
  const colors = {
    default: 'text-gray-900',
    green: 'text-[#3c7b48]',
    orange: 'text-[#ee922c]'
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <p className="text-sm text-gray-500 mb-1">{title}</p>
      <p className={`font-display font-black text-3xl ${colors[color]}`}>{value}</p>
    </div>
  );
}

// Generic Data Table Component
function DataTable({ title, data, columns, onAdd, onEdit, onDelete, loading, extraActions }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="font-display font-bold text-xl">{title}</h2>
        <Button onClick={onAdd} className="bg-[#ee922c] hover:bg-[#d9811f]">
          <Plus className="w-4 h-4 mr-2" /> Add New
        </Button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => <TableHead key={col.key}>{col.label}</TableHead>)}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={columns.length + 1} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow>
            ) : data.length === 0 ? (
              <TableRow><TableCell colSpan={columns.length + 1} className="text-center py-8 text-gray-500">No data yet</TableCell></TableRow>
            ) : (
              data.map((item) => (
                <TableRow key={item.id}>
                  {columns.map((col) => (
                    <TableCell key={col.key}>{col.render ? col.render(item[col.key], item) : item[col.key]}</TableCell>
                  ))}
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      {extraActions && extraActions(item)}
                      <Button variant="ghost" size="sm" onClick={() => onEdit(item)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" className="text-red-500" onClick={() => onDelete(item)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </motion.div>
  );
}

// Coupon Dialog
function CouponDialog({ open, onOpenChange, item, categories, onSuccess }) {
  const [form, setForm] = useState({ title: '', description: '', code: '', discount_type: 'percentage', discount_value: '', brand_name: '', category_name: '', affiliate_url: '', image_url: '', is_featured: false });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (item) setForm({ ...item, discount_value: item.discount_value || '' });
    else setForm({ title: '', description: '', code: '', discount_type: 'percentage', discount_value: '', brand_name: '', category_name: '', affiliate_url: '', image_url: '', is_featured: false });
  }, [item, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form, discount_value: form.discount_value ? parseFloat(form.discount_value) : null };
      if (item) await updateCoupon(item.id, payload);
      else await createCoupon(payload);
      toast.success(item ? 'Updated!' : 'Created!');
      onSuccess();
    } catch (error) {
      toast.error('Failed to save');
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{item ? 'Edit Deal' : 'Add Deal'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
            <div><Label>Brand *</Label><Input value={form.brand_name} onChange={(e) => setForm({ ...form, brand_name: e.target.value })} required /></div>
            <div><Label>Category *</Label>
              <Select value={form.category_name} onValueChange={(v) => setForm({ ...form, category_name: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></div>
            <div><Label>Discount Value</Label><Input type="number" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} /></div>
            <div className="col-span-2"><Label>Affiliate URL *</Label><Input type="url" value={form.affiliate_url} onChange={(e) => setForm({ ...form, affiliate_url: e.target.value })} required /></div>
            <div className="col-span-2"><Label>Image URL</Label><Input type="url" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} /></div>
            <div className="col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="flex items-center gap-2"><input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} /><Label className="mb-0">Featured</Label></div>
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={loading} className="flex-1 bg-[#ee922c]">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Category Dialog
function CategoryDialog({ open, onOpenChange, item, onSuccess }) {
  const [form, setForm] = useState({ name: '', slug: '', description: '', image_url: '', icon: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (item) setForm({ name: item.name || '', slug: item.slug || '', description: item.description || '', image_url: item.image_url || '', icon: item.icon || '' });
    else setForm({ name: '', slug: '', description: '', image_url: '', icon: '' });
  }, [item, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (item) await updateCategory(item.id, form);
      else await createCategory(form);
      toast.success(item ? 'Updated!' : 'Created!');
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save');
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{item ? 'Edit Category' : 'Add Category'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} required /></div>
          <div><Label>Slug *</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required /></div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div><Label>Image URL</Label><Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} /></div>
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={loading} className="flex-1 bg-[#ee922c]">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Pretty Link Dialog
function PrettyLinkDialog({ open, onOpenChange, item, onSuccess }) {
  const [form, setForm] = useState({ slug: '', destination_url: '', title: '', description: '', is_active: true });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (item) setForm({ slug: item.slug || '', destination_url: item.destination_url || '', title: item.title || '', description: item.description || '', is_active: item.is_active !== false });
    else setForm({ slug: '', destination_url: '', title: '', description: '', is_active: true });
  }, [item, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (item) await updatePrettyLink(item.id, form);
      else await createPrettyLink(form);
      toast.success(item ? 'Updated!' : 'Created!');
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save');
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{item ? 'Edit Pretty Link' : 'Add Pretty Link'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><Label>Slug * (e.g., amazon-deals)</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} required placeholder="amazon-deals" /></div>
          <div><Label>Destination URL *</Label><Input type="url" value={form.destination_url} onChange={(e) => setForm({ ...form, destination_url: e.target.value })} required placeholder="https://amazon.in?tag=xxx" /></div>
          <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Amazon Deals" /></div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="flex items-center gap-2"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /><Label className="mb-0">Active</Label></div>
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={loading} className="flex-1 bg-[#ee922c]">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Page Dialog
function PageDialog({ open, onOpenChange, item, onSuccess }) {
  const [form, setForm] = useState({ slug: '', title: '', content: '', meta_description: '', is_published: true });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (item) setForm({ slug: item.slug || '', title: item.title || '', content: item.content || '', meta_description: item.meta_description || '', is_published: item.is_published !== false });
    else setForm({ slug: '', title: '', content: '', meta_description: '', is_published: true });
  }, [item, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (item) await updatePage(item.id, form);
      else await createPage(form);
      toast.success(item ? 'Updated!' : 'Created!');
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save');
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{item ? 'Edit Page' : 'Add Page'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value, slug: item ? form.slug : e.target.value.toLowerCase().replace(/\s+/g, '-') })} required /></div>
            <div><Label>Slug *</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required /></div>
          </div>
          <div><Label>Meta Description</Label><Input value={form.meta_description} onChange={(e) => setForm({ ...form, meta_description: e.target.value })} /></div>
          <div><Label>Content (Markdown) *</Label><Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={15} required className="font-mono text-sm" /></div>
          <div className="flex items-center gap-2"><input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} /><Label className="mb-0">Published</Label></div>
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={loading} className="flex-1 bg-[#ee922c]">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Blog Dialog
function BlogDialog({ open, onOpenChange, item, onSuccess }) {
  const [form, setForm] = useState({ slug: '', title: '', excerpt: '', content: '', featured_image: '', category: 'Saving Tips', is_published: true });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (item) setForm({ slug: item.slug || '', title: item.title || '', excerpt: item.excerpt || '', content: item.content || '', featured_image: item.featured_image || '', category: item.category || 'Saving Tips', is_published: item.is_published !== false });
    else setForm({ slug: '', title: '', excerpt: '', content: '', featured_image: '', category: 'Saving Tips', is_published: true });
  }, [item, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (item) await updateBlogPost(item.id, form);
      else await createBlogPost(form);
      toast.success(item ? 'Updated!' : 'Created!');
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save');
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{item ? 'Edit Blog Post' : 'Add Blog Post'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value, slug: item ? form.slug : e.target.value.toLowerCase().replace(/\s+/g, '-') })} required /></div>
            <div><Label>Slug *</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Saving Tips">Saving Tips</SelectItem>
                  <SelectItem value="Coupon Guides">Coupon Guides</SelectItem>
                  <SelectItem value="Deal Strategies">Deal Strategies</SelectItem>
                  <SelectItem value="Electronics">Electronics</SelectItem>
                  <SelectItem value="Fashion">Fashion</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Featured Image URL</Label><Input value={form.featured_image} onChange={(e) => setForm({ ...form, featured_image: e.target.value })} /></div>
          </div>
          <div><Label>Excerpt *</Label><Textarea value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} rows={2} required /></div>
          <div><Label>Content (Markdown) *</Label><Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={15} required className="font-mono text-sm" /></div>
          <div className="flex items-center gap-2"><input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} /><Label className="mb-0">Published</Label></div>
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={loading} className="flex-1 bg-[#ee922c]">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
