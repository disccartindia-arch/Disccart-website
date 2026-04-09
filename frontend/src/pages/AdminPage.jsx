import { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Tag, Upload, Link2, FileText, BookOpen,
  Plus, Pencil, Trash2, X, Loader2, FileSpreadsheet,
  ExternalLink, ImagePlus, Search, Globe, Eye, EyeOff,
  Store, SlidersHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '../components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '../components/ui/dialog';
import {
  getCoupons, createCoupon, updateCoupon, deleteCoupon, bulkDeleteCoupons,
  bulkUploadCoupons, getAnalyticsOverview, getCategories,
  createCategory, updateCategory, deleteCategory,
  getPrettyLinks, createPrettyLink, updatePrettyLink, deletePrettyLink,
  getPages, createPage, updatePage, deletePage,
  getBlogPosts, createBlogPost, updateBlogPost, deleteBlogPost,
  uploadImage, resolveImageUrl,
  getStores, createStore, updateStore, deleteStore,
  getFilterConfig, updateFilterConfig
} from '../lib/api';
import { AdminSEO } from '../components/SEO';

export default function AdminPage() {
  const { isAuthenticated, isAdmin, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  // Data States
  const [coupons, setCoupons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [prettyLinks, setPrettyLinks] = useState([]);
  const [pages, setPages] = useState([]);
  const [blogPosts, setBlogPosts] = useState([]);
  const [stores, setStores] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  // Search
  const [searchTerm, setSearchTerm] = useState('');

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Dialog States
  const [showCouponDialog, setShowCouponDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showPageDialog, setShowPageDialog] = useState(false);
  const [showBlogDialog, setShowBlogDialog] = useState(false);
  const [showStoreDialog, setShowStoreDialog] = useState(false);

  // Edit State
  const [editingItem, setEditingItem] = useState(null);
  const fileInputRef = useRef(null);
  const [uploadStatus, setUploadStatus] = useState(null);

  useEffect(() => {
    if (isAdmin) fetchData();
  }, [isAdmin]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [couponsData, analyticsData, categoriesData, linksData, pagesData, blogData, storesData] = await Promise.all([
        getCoupons({ limit: 100 }),
        getAnalyticsOverview().catch(() => null),
        getCategories().catch(() => []),
        getPrettyLinks().catch(() => []),
        getPages().catch(() => []),
        getBlogPosts(false).catch(() => []),
        getStores().catch(() => [])
      ]);
      setCoupons(Array.isArray(couponsData) ? couponsData : []);
      setAnalytics(analyticsData);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      setPrettyLinks(Array.isArray(linksData) ? linksData : []);
      setPages(Array.isArray(pagesData) ? pagesData : []);
      setBlogPosts(Array.isArray(blogData) ? blogData : []);
      setStores(Array.isArray(storesData) ? storesData : []);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#ee922c]" />
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return <Navigate to="/login" replace />;
  }

  // --- NATIVE CSV PARSER (Fixes Vercel Rollup Error) ---
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadStatus({ loading: true, message: 'Processing CSV...' });

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

        const mappedData = lines.slice(1).filter(line => line.trim() !== '').map(line => {
          const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          const row = {};
          headers.forEach((header, index) => { row[header] = values[index]; });

          return {
            title: row['Title'],
            original_price: row['Original Price'] ? parseFloat(row['Original Price']) : null,
            discounted_price: row['Discounted Price'] ? parseFloat(row['Discounted Price']) : null,
            brand_name: row['brand/MERCHANT'],
            category_name: row['Category'],
            offer_type: (row['Offer type'] || 'deal').toLowerCase(),
            code: row['promo code (coupon)'] || '',
            affiliate_url: row['affiliate url'],
            is_active: true
          };
        });

        await bulkUploadCoupons(mappedData);
        setUploadStatus({ loading: false, success: true, message: 'Bulk Upload Successful' });
        toast.success(`${mappedData.length} items added to inventory`);
        fetchData();
      } catch (err) {
        setUploadStatus({ loading: false, success: false, message: 'Upload Failed' });
        toast.error('CSV format mismatch. Ensure headers match exactly.');
      }
    };
    reader.readAsText(file);
  };

  const handleDelete = async (type, id, name) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      if (type === 'coupon') await deleteCoupon(id);
      if (type === 'category') await deleteCategory(id);
      if (type === 'store') await deleteStore(id);
      if (type === 'link') await deletePrettyLink(id);
      if (type === 'page') await deletePage(id);
      if (type === 'blog') await deleteBlogPost(id);
      toast.success('Item removed');
      fetchData();
    } catch {
      toast.error('Delete failed');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedIds.length} selected deals? This cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      await bulkDeleteCoupons(selectedIds);
      toast.success(`${selectedIds.length} deals deleted`);
      setSelectedIds([]);
      fetchData();
    } catch {
      toast.error('Bulk delete failed');
    } finally {
      setBulkDeleting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredCoupons.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredCoupons.map(c => c.id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const filteredCoupons = coupons.filter(c => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      (c.title || '').toLowerCase().includes(q) ||
      (c.brand_name || '').toLowerCase().includes(q) ||
      (c.code || '').toLowerCase().includes(q) ||
      (c.category_name || '').toLowerCase().includes(q)
    );
  });

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'coupons', label: 'Deals & Coupons', icon: Tag },
    { id: 'categories', label: 'Categories', icon: Plus },
    { id: 'stores', label: 'Stores', icon: Store },
    { id: 'filters', label: 'Filter Settings', icon: SlidersHorizontal },
    { id: 'upload', label: 'Bulk Import', icon: Upload },
    { id: 'links', label: 'Pretty Links', icon: Link2 },
    { id: 'pages', label: 'Pages', icon: FileText },
    { id: 'blog', label: 'Blog Posts', icon: BookOpen },
  ];

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20 md:pb-10">
      <AdminSEO />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">Admin Control Center</h1>
            <p className="text-gray-500 mt-1">Manage deals, categories, and site content</p>
          </div>
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh Data'}
          </Button>
        </header>

        <div className="flex flex-wrap gap-2 mb-8 bg-white p-2 rounded-2xl border shadow-sm">
          {tabs.map((item) => (
            <Button
              key={item.id}
              variant={activeTab === item.id ? 'default' : 'ghost'}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-2 rounded-xl transition-all ${activeTab === item.id ? 'bg-[#ee922c] hover:bg-[#d9811f]' : ''}`}
            >
              <item.icon className="w-4 h-4" />
              <span className="font-semibold">{item.label}</span>
            </Button>
          ))}
        </div>

        <div className="bg-white rounded-3xl border shadow-sm min-h-[500px] overflow-hidden">
          <AnimatePresence mode="wait">

            {activeTab === 'dashboard' && (
              <motion.div key="dashboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-8 space-y-8">
                <h2 className="text-2xl font-bold">Overview</h2>
                {analytics ? (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                      { label: 'Total Deals', value: analytics.total_coupons, color: 'text-blue-600' },
                      { label: 'Active Deals', value: analytics.active_coupons, color: 'text-green-600' },
                      { label: 'Total Clicks', value: analytics.total_clicks, color: 'text-orange-600' },
                      { label: 'Users', value: analytics.total_users, color: 'text-purple-600' },
                      { label: 'Categories', value: analytics.total_categories, color: 'text-pink-600' },
                    ].map((stat) => (
                      <div key={stat.label} className="bg-gray-50 rounded-2xl p-6 border">
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{stat.label}</p>
                        <p className={`text-3xl font-black mt-2 ${stat.color}`}>{stat.value || 0}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
                )}
              </motion.div>
            )}

            {activeTab === 'coupons' && (
              <motion.div key="coupons" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h2 className="text-2xl font-bold">Deal Inventory</h2>
                  <Button onClick={() => { setEditingItem(null); setShowCouponDialog(true); }} className="bg-[#ee922c]">
                    <Plus className="w-4 h-4 mr-2" /> Add New Deal
                  </Button>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search for any deal to edit or delete..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-10 h-12 rounded-xl"
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Bulk actions bar */}
                {selectedIds.length > 0 && (
                  <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3" data-testid="bulk-actions-bar">
                    <span className="text-sm font-semibold text-red-700">{selectedIds.length} selected</span>
                    <Button variant="outline" size="sm" className="text-red-600 border-red-300 hover:bg-red-100" onClick={handleBulkDelete} disabled={bulkDeleting} data-testid="bulk-delete-btn">
                      {bulkDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
                      Delete Selected
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])} data-testid="bulk-clear-btn">Clear</Button>
                  </div>
                )}

                <Table data-testid="deals-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <input type="checkbox" checked={filteredCoupons.length > 0 && selectedIds.length === filteredCoupons.length} onChange={toggleSelectAll} className="rounded" data-testid="select-all-checkbox" />
                      </TableHead>
                      <TableHead>Preview</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCoupons.map((c) => (
                      <TableRow key={c.id} className={selectedIds.includes(c.id) ? 'bg-orange-50' : ''}>
                        <TableCell>
                          <input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggleSelect(c.id)} className="rounded" data-testid={`select-deal-${c.id}`} />
                        </TableCell>
                        <TableCell>
                          <div className="w-12 h-12 rounded-lg bg-gray-100 border overflow-hidden">
                            {c.image_url ? (
                              <img src={resolveImageUrl(c.image_url)} className="w-full h-full object-cover" alt="" onError={(e) => { e.target.style.display='none'; }} />
                            ) : (
                              <Tag className="w-full h-full p-3 text-gray-300" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold max-w-[300px] truncate">{c.title}</TableCell>
                        <TableCell><span className="px-2 py-1 bg-gray-100 rounded-md text-xs font-bold">{c.brand_name}</span></TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {c.offer_type ? (c.offer_type).split(',').map(t => t.trim()).filter(Boolean).map(t => (
                              <span key={t} className={`px-2 py-0.5 rounded-md text-xs font-bold ${t === 'deal' ? 'bg-green-100 text-green-700' : t === 'limited' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                                {t === 'deal' ? 'Deal' : t === 'limited' ? 'Limited' : 'Coupon'}
                              </span>
                            )) : <span className="text-xs text-gray-400">—</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-green-700 font-bold">{c.discounted_price ? `₹${c.discounted_price}` : '-'}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="outline" size="sm" onClick={() => { setEditingItem(c); setShowCouponDialog(true); }} data-testid={`edit-deal-${c.id}`}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="outline" size="sm" className="text-red-500" onClick={() => handleDelete('coupon', c.id, c.title)} data-testid={`delete-deal-${c.id}`}><Trash2 className="w-4 h-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredCoupons.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center py-12 text-gray-400">{searchTerm ? 'No deals match your search.' : 'No deals found.'}</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </motion.div>
            )}

            {activeTab === 'categories' && (
              <motion.div key="categories" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Categories</h2>
                  <Button onClick={() => { setEditingItem(null); setShowCategoryDialog(true); }} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" /> Add Category
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {categories.map((cat) => (
                    <div key={cat.id} className="border rounded-2xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {cat.background_image_url ? (
                          <div className="w-14 h-14 rounded-xl overflow-hidden border bg-gray-100 flex-shrink-0">
                            <img src={resolveImageUrl(cat.background_image_url)} alt={cat.name} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-gray-100 border flex items-center justify-center flex-shrink-0">
                            <ImagePlus className="w-5 h-5 text-gray-300" />
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-lg">{cat.name}</p>
                          <p className="text-sm text-gray-400">{cat.coupon_count || 0} deals</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => { setEditingItem(cat); setShowCategoryDialog(true); }}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="outline" size="sm" className="text-red-500" onClick={() => handleDelete('category', cat.id, cat.name)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'stores' && (
              <motion.div key="stores" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Stores</h2>
                  <Button onClick={() => { setEditingItem(null); setShowStoreDialog(true); }} className="bg-[#ee922c]">
                    <Plus className="w-4 h-4 mr-2" /> Add Store
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {stores.map((store) => (
                    <div key={store.id} className="border rounded-2xl p-4 flex items-center justify-between" data-testid={`store-card-${store.id}`}>
                      <div className="flex items-center gap-4">
                        {store.logo_url ? (
                          <div className="w-14 h-14 rounded-xl overflow-hidden border bg-gray-100 flex-shrink-0">
                            <img src={store.logo_url} alt={store.name} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-gray-100 border flex items-center justify-center flex-shrink-0">
                            <Store className="w-5 h-5 text-gray-300" />
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-lg">{store.name}</p>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${store.show_in_filter !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {store.show_in_filter !== false ? 'Visible in filter' : 'Hidden'}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => { setEditingItem(store); setShowStoreDialog(true); }} data-testid={`edit-store-${store.id}`}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="outline" size="sm" className="text-red-500" onClick={() => handleDelete('store', store.id, store.name)} data-testid={`delete-store-${store.id}`}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  ))}
                  {stores.length === 0 && <p className="text-gray-400 col-span-3 text-center py-12">No stores added yet.</p>}
                </div>
              </motion.div>
            )}

            {activeTab === 'filters' && (
              <FilterSettingsTab categories={categories} stores={stores} onRefresh={fetchData} />
            )}

            {activeTab === 'upload' && (
              <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-20 text-center">
                <FileSpreadsheet className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Bulk CSV Import</h2>
                <p className="text-gray-500 mb-8 max-w-md mx-auto">Upload your 8-column CSV. These items will appear in your Inventory where you can edit or delete them.</p>
                <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                <Button size="lg" onClick={() => fileInputRef.current?.click()} className="bg-[#ee922c] h-14 px-8 rounded-2xl">
                  {uploadStatus?.loading ? <Loader2 className="animate-spin mr-2" /> : <Upload className="mr-2" />}
                  Select CSV File
                </Button>
                {uploadStatus && <p className={`mt-4 font-semibold ${uploadStatus.success ? 'text-green-600' : 'text-red-500'}`}>{uploadStatus.message}</p>}
              </motion.div>
            )}

            {activeTab === 'links' && (
              <motion.div key="links" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Pretty Links</h2>
                  <Button onClick={() => { setEditingItem(null); setShowLinkDialog(true); }} className="bg-[#ee922c]">
                    <Plus className="w-4 h-4 mr-2" /> Add Link
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Slug</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead>Clicks</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prettyLinks.map(link => (
                      <TableRow key={link.id}>
                        <TableCell className="font-mono text-blue-600">/{link.slug}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{link.destination_url}</TableCell>
                        <TableCell>{link.clicks || 0}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => { setEditingItem(link); setShowLinkDialog(true); }}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete('link', link.id, link.slug)}><Trash2 className="w-4 h-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </motion.div>
            )}

            {activeTab === 'pages' && (
              <motion.div key="pages" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Pages</h2>
                  <Button onClick={() => { setEditingItem(null); setShowPageDialog(true); }} className="bg-[#ee922c]">
                    <Plus className="w-4 h-4 mr-2" /> Add Page
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pages.map(page => (
                      <TableRow key={page.id}>
                        <TableCell className="font-bold">{page.title}</TableCell>
                        <TableCell>/{page.slug}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => { setEditingItem(page); setShowPageDialog(true); }}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete('page', page.id, page.title)}><Trash2 className="w-4 h-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </motion.div>
            )}

            {activeTab === 'blog' && (
              <motion.div key="blog" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Blog Posts</h2>
                  <Button onClick={() => { setEditingItem(null); setShowBlogDialog(true); }} className="bg-[#ee922c]">
                    <Plus className="w-4 h-4 mr-2" /> Add Post
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {blogPosts.map(post => (
                      <TableRow key={post.id}>
                        <TableCell className="font-bold">{post.title}</TableCell>
                        <TableCell>{post.published ? 'Published' : 'Draft'}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => { setEditingItem(post); setShowBlogDialog(true); }}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete('blog', post.id, post.title)}><Trash2 className="w-4 h-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* --- FORMS AND DIALOGS --- */}

      <Dialog open={showCouponDialog} onOpenChange={setShowCouponDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">{editingItem ? 'Edit Deal' : 'Add New Deal'}</DialogTitle>
          </DialogHeader>
          <CouponForm item={editingItem} categories={categories} onSuccess={() => { setShowCouponDialog(false); fetchData(); }} />
        </DialogContent>
      </Dialog>

      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent className="rounded-3xl">
          <DialogHeader><DialogTitle>{editingItem ? 'Edit Category' : 'Create Category'}</DialogTitle></DialogHeader>
          <CategoryForm item={editingItem} onSuccess={() => { setShowCategoryDialog(false); fetchData(); }} />
        </DialogContent>
      </Dialog>

      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="rounded-3xl">
          <DialogHeader><DialogTitle>Pretty Link Manager</DialogTitle></DialogHeader>
          <PrettyLinkForm item={editingItem} onSuccess={() => { setShowLinkDialog(false); fetchData(); }} />
        </DialogContent>
      </Dialog>

      <Dialog open={showPageDialog} onOpenChange={setShowPageDialog}>
        <DialogContent className="max-w-2xl rounded-3xl">
          <DialogHeader><DialogTitle>Page Editor</DialogTitle></DialogHeader>
          <PageForm item={editingItem} onSuccess={() => { setShowPageDialog(false); fetchData(); }} />
        </DialogContent>
      </Dialog>

      <Dialog open={showBlogDialog} onOpenChange={setShowBlogDialog}>
        <DialogContent className="max-w-2xl rounded-3xl">
          <DialogHeader><DialogTitle>Blog Post Editor</DialogTitle></DialogHeader>
          <BlogForm item={editingItem} onSuccess={() => { setShowBlogDialog(false); fetchData(); }} />
        </DialogContent>
      </Dialog>

      <Dialog open={showStoreDialog} onOpenChange={setShowStoreDialog}>
        <DialogContent className="rounded-3xl">
          <DialogHeader><DialogTitle>{editingItem ? 'Edit Store' : 'Add Store'}</DialogTitle></DialogHeader>
          <StoreForm item={editingItem} onSuccess={() => { setShowStoreDialog(false); fetchData(); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ================================================================
   REVISED FORMS (WITH FIXES)
   ================================================================ */

function CouponForm({ item, categories, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [imageUrl, setImageUrl] = useState(item?.image_url || '');
  const [filePreview, setFilePreview] = useState(item?.image_url || null);

  const [form, setForm] = useState({
    title: item?.title || '',
    brand_name: item?.brand_name || '',
    category_name: item?.category_name ? item.category_name.split(",") : [],
    original_price: item?.original_price || '',
    discounted_price: item?.discounted_price || '',
    affiliate_url: item?.affiliate_url || '',
    code: item?.code || '',
    offer_type: item?.offer_type || '',
    is_active: item?.is_active ?? true
  });

  // 📸 IMAGE UPLOAD
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFilePreview(URL.createObjectURL(file));
    setUploading(true);

    try {
      const url = await uploadImage(file);
      setImageUrl(url);
      toast.success("Image Uploaded");
    } catch {
      toast.error("Upload Failed");
    } finally {
      setUploading(false);
    }
  };

  // ❌ REMOVE IMAGE
  const handleRemoveImage = () => {
    setImageUrl('');
    setFilePreview(null);
  };

  // 📤 SUBMIT
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...form,
        image_url: imageUrl || null,
        category_name: form.category_name.join(","),
        offer_type: form.offer_type || null,
        original_price: form.original_price === '' ? null : parseInt(form.original_price, 10),
        discounted_price: form.discounted_price === '' ? null : parseInt(form.discounted_price, 10)
      };

      if (item) await updateCoupon(item.id, payload);
      else await createCoupon(payload);

      toast.success("Saved Successfully");
      onSuccess();
    } catch {
      toast.error("Save failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">

      {/* IMAGE */}
      <div className="space-y-2">
        <Label>Deal Image</Label>

        <div className="relative group w-full h-40 border-2 border-dashed rounded-2xl flex items-center justify-center bg-gray-50 overflow-hidden">

          {filePreview ? (
            <>
              <img src={filePreview} className="w-full h-full object-contain p-2" />

              {/* ❌ REMOVE BUTTON */}
              <button
                type="button"
                onClick={handleRemoveImage}
                className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full shadow hover:bg-red-600"
              >
                <X size={16} />
              </button>
            </>
          ) : (
            <label className="flex flex-col items-center cursor-pointer">
              <ImagePlus className="text-gray-400 mb-2" size={32} />
              <span className="text-sm text-gray-500">Upload Photo</span>
              <input type="file" className="hidden" onChange={handleFileChange} accept="image/*" />
            </label>
          )}

          {uploading && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
              <Loader2 className="animate-spin text-orange-500" />
            </div>
          )}
        </div>
      </div>

      {/* TITLE */}
      <Input
        placeholder="Title"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        required
      />

      {/* OFFER TYPE - MULTI SELECT */}
      <div className="space-y-2">
        <Label>Offer Type</Label>
        <div className="flex flex-wrap gap-3">
          {[
            { value: 'deal', label: 'Deal', color: 'bg-green-100 text-green-700 border-green-300' },
            { value: 'coupon', label: 'Coupon', color: 'bg-orange-100 text-orange-700 border-orange-300' },
            { value: 'limited', label: 'Limited Time', color: 'bg-red-100 text-red-700 border-red-300' },
          ].map(opt => {
            const offerTypes = (form.offer_type || '').split(',').filter(Boolean);
            const isChecked = offerTypes.includes(opt.value);
            return (
              <label
                key={opt.value}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-all ${isChecked ? opt.color + ' border-current' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'}`}
                data-testid={`offer-type-${opt.value}`}
              >
                <input
                  type="checkbox"
                  className="rounded"
                  checked={isChecked}
                  onChange={() => {
                    const current = offerTypes;
                    const updated = isChecked
                      ? current.filter(v => v !== opt.value)
                      : [...current, opt.value];
                    setForm({ ...form, offer_type: updated.join(',') || '' });
                  }}
                />
                <span className="text-sm font-semibold">{opt.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 🔥 MULTI CATEGORY */}
      <div className="space-y-2">
        <Label>Select Categories</Label>

        <div className="grid grid-cols-2 gap-2">
          {categories.map((cat) => (
            <label key={cat.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                value={cat.name}
                checked={form.category_name.includes(cat.name)}
                onChange={(e) => {
                  const val = e.target.value;

                  setForm((prev) => ({
                    ...prev,
                    category_name: prev.category_name.includes(val)
                      ? prev.category_name.filter((c) => c !== val)
                      : [...prev.category_name, val],
                  }));
                }}
              />
              {cat.name}
            </label>
          ))}
        </div>
      </div>

      {/* BRAND + CODE */}
      <div className="grid grid-cols-2 gap-4">
        <Input
          placeholder="Brand"
          value={form.brand_name}
          onChange={(e) => setForm({ ...form, brand_name: e.target.value })}
          required
        />

        <Input
          placeholder="Promo Code"
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
        />
      </div>

      {/* PRICES */}
      <div className="grid grid-cols-2 gap-4">
        <Input
          type="number"
          placeholder="Original Price"
          value={form.original_price}
          onChange={(e) => setForm({ ...form, original_price: e.target.value })}
        />

        <Input
          type="number"
          placeholder="Discounted Price"
          value={form.discounted_price}
          onChange={(e) => setForm({ ...form, discounted_price: e.target.value })}
        />
      </div>

      {/* URL */}
      <Input
        placeholder="Affiliate URL"
        value={form.affiliate_url}
        onChange={(e) => setForm({ ...form, affiliate_url: e.target.value })}
        required
      />

      {/* SUBMIT */}
      <Button
        type="submit"
        className="w-full h-12 bg-[#ee922c]"
        disabled={loading || uploading}
      >
        {loading ? <Loader2 className="animate-spin" /> : "Save Deal"}
      </Button>
    </form>
  );
}

function CategoryForm({ item, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(item?.name || '');
  const [bgUrl, setBgUrl] = useState(item?.background_image_url || '');
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { name, background_image_url: bgUrl };
      if (item) await updateCategory(item.id, payload);
      else await createCategory(payload);
      onSuccess();
    } catch { toast.error("Failed to save"); } finally { setLoading(false); }
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      <Input placeholder="Category Name" value={name} onChange={e => setName(e.target.value)} required />
      <Input placeholder="Image URL (Optional)" value={bgUrl} onChange={e => setBgUrl(e.target.value)} />
      <Button type="submit" className="w-full h-12" disabled={loading}>Confirm</Button>
    </form>
  );
}

function PrettyLinkForm({ item, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(item || { slug: '', destination_url: '', clicks: 0 });
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (item) await updatePrettyLink(item.id, form);
      else await createPrettyLink(form);
      onSuccess();
    } catch { toast.error("Failed"); } finally { setLoading(false); }
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      <Input placeholder="Slug (e.g. amazon)" value={form.slug} onChange={e => setForm({...form, slug: e.target.value})} required />
      <Input placeholder="Destination URL" value={form.destination_url} onChange={e => setForm({...form, destination_url: e.target.value})} required />
      <Button type="submit" className="w-full" disabled={loading}>Save Link</Button>
    </form>
  );
}

function PageForm({ item, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(item || { title: '', slug: '', content: '' });
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (item) await updatePage(item.id, form);
      else await createPage(form);
      onSuccess();
    } catch { toast.error("Failed"); } finally { setLoading(false); }
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      <Input placeholder="Title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required />
      <Input placeholder="Slug" value={form.slug} onChange={e => setForm({...form, slug: e.target.value})} required />
      <Textarea placeholder="Content" value={form.content} onChange={e => setForm({...form, content: e.target.value})} />
      <Button type="submit" className="w-full" disabled={loading}>Save Page</Button>
    </form>
  );
}

function BlogForm({ item, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(item || { title: '', content: '', published: true });
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (item) await updateBlogPost(item.id, form);
      else await createBlogPost(form);
      onSuccess();
    } catch { toast.error("Failed"); } finally { setLoading(false); }
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      <Input placeholder="Post Title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required />
      <Textarea placeholder="Content" value={form.content} onChange={e => setForm({...form, content: e.target.value})} />
      <div className="flex items-center gap-2">
         <input type="checkbox" checked={form.published} onChange={e => setForm({...form, published: e.target.checked})} />
         <Label>Published</Label>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>Save Post</Button>
    </form>
  );
}


function StoreForm({ item, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: item?.name || '',
    logo_url: item?.logo_url || '',
    show_in_filter: item?.show_in_filter ?? true
  });
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (item) await updateStore(item.id, form);
      else await createStore(form);
      toast.success('Store saved');
      onSuccess();
    } catch { toast.error('Failed to save store'); } finally { setLoading(false); }
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4" data-testid="store-form">
      <Input placeholder="Store Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required data-testid="store-name-input" />
      <Input placeholder="Logo URL (optional)" value={form.logo_url} onChange={e => setForm({ ...form, logo_url: e.target.value })} data-testid="store-logo-input" />
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={form.show_in_filter} onChange={e => setForm({ ...form, show_in_filter: e.target.checked })} data-testid="store-filter-toggle" />
        <Label>Show in filter</Label>
      </div>
      <Button type="submit" className="w-full h-12" disabled={loading} data-testid="store-save-btn">
        {loading ? <Loader2 className="animate-spin" /> : 'Save Store'}
      </Button>
    </form>
  );
}

function FilterSettingsTab({ categories, stores, onRefresh }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [brackets, setBrackets] = useState([]);
  const [catFilters, setCatFilters] = useState([]);
  const [storeFilters, setStoreFilters] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await getFilterConfig();
        setBrackets(data.price_brackets || []);
        setCatFilters((data.categories || []).map(c => ({ id: c.id, name: c.name, show_in_filter: c.show_in_filter !== false })));
        setStoreFilters((data.stores || []).map(s => ({ id: s.id, name: s.name, show_in_filter: s.show_in_filter !== false })));
      } catch { toast.error('Failed to load filter config'); }
      finally { setLoading(false); }
    })();
  }, [categories, stores]);

  const addBracket = () => {
    setBrackets([...brackets, { label: '', min: 0, max: 0 }]);
  };

  const removeBracket = (idx) => {
    setBrackets(brackets.filter((_, i) => i !== idx));
  };

  const updateBracket = (idx, field, value) => {
    const updated = [...brackets];
    updated[idx] = { ...updated[idx], [field]: field === 'label' ? value : parseInt(value, 10) || 0 };
    setBrackets(updated);
  };

  const toggleCatFilter = (id) => {
    setCatFilters(prev => prev.map(c => c.id === id ? { ...c, show_in_filter: !c.show_in_filter } : c));
  };

  const toggleStoreFilter = (id) => {
    setStoreFilters(prev => prev.map(s => s.id === id ? { ...s, show_in_filter: !s.show_in_filter } : s));
  };

  const handleSave = async () => {
    setError('');
    for (const b of brackets) {
      if (b.min > b.max) {
        setError(`Invalid bracket "${b.label || 'Untitled'}": min (${b.min}) cannot be greater than max (${b.max})`);
        return;
      }
    }
    setSaving(true);
    try {
      await updateFilterConfig({
        price_brackets: brackets,
        categories: catFilters.map(c => ({ id: c.id, show_in_filter: c.show_in_filter })),
        stores: storeFilters.map(s => ({ id: s.id, show_in_filter: s.show_in_filter }))
      });
      toast.success('Filter settings saved');
      onRefresh();
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>;

  return (
    <motion.div key="filters" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 space-y-8" data-testid="filter-settings-tab">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Filter Settings</h2>
        <Button onClick={handleSave} disabled={saving} className="bg-[#ee922c]" data-testid="save-filters-btn">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Save All Changes
        </Button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-semibold" data-testid="filter-error">{error}</div>}

      {/* Price Brackets */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Price Brackets</h3>
          <Button variant="outline" size="sm" onClick={addBracket} data-testid="add-bracket-btn"><Plus className="w-4 h-4 mr-1" /> Add Bracket</Button>
        </div>
        {brackets.length === 0 && <p className="text-gray-400 text-sm">No price brackets configured.</p>}
        {brackets.map((b, idx) => (
          <div key={idx} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 border" data-testid={`bracket-row-${idx}`}>
            <Input placeholder="Label (e.g. Under 500)" value={b.label} onChange={e => updateBracket(idx, 'label', e.target.value)} className="flex-1" />
            <Input type="number" placeholder="Min" value={b.min} onChange={e => updateBracket(idx, 'min', e.target.value)} className="w-28" />
            <span className="text-gray-400 font-bold">—</span>
            <Input type="number" placeholder="Max" value={b.max} onChange={e => updateBracket(idx, 'max', e.target.value)} className="w-28" />
            <Button variant="ghost" size="sm" className="text-red-500" onClick={() => removeBracket(idx)}><Trash2 className="w-4 h-4" /></Button>
          </div>
        ))}
      </div>

      {/* Category Filter Toggles */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold">Category Visibility in Filters</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {catFilters.map(c => (
            <label key={c.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${c.show_in_filter ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`} data-testid={`cat-filter-${c.id}`}>
              <input type="checkbox" checked={c.show_in_filter} onChange={() => toggleCatFilter(c.id)} className="rounded" />
              <span className="font-semibold text-sm">{c.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Store Filter Toggles */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold">Store Visibility in Filters</h3>
        {storeFilters.length === 0 && <p className="text-gray-400 text-sm">No stores added yet. Add stores from the Stores tab.</p>}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {storeFilters.map(s => (
            <label key={s.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${s.show_in_filter ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`} data-testid={`store-filter-${s.id}`}>
              <input type="checkbox" checked={s.show_in_filter} onChange={() => toggleStoreFilter(s.id)} className="rounded" />
              <span className="font-semibold text-sm">{s.name}</span>
            </label>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
