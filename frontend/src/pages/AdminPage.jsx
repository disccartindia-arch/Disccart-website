import { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Tag, Upload, Link2, FileText, BookOpen,
  Plus, Pencil, Trash2, X, Loader2, FileSpreadsheet,
  ExternalLink, ImagePlus, Search, Globe, Eye, EyeOff
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
  getCoupons, createCoupon, updateCoupon, deleteCoupon,
  bulkUploadCoupons, getAnalyticsOverview, getCategories,
  createCategory, updateCategory, deleteCategory,
  getPrettyLinks, createPrettyLink, updatePrettyLink, deletePrettyLink,
  getPages, createPage, updatePage, deletePage,
  getBlogPosts, createBlogPost, updateBlogPost, deleteBlogPost,
  uploadImage
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

  // Search
  const [searchTerm, setSearchTerm] = useState('');

  // Dialogs
  const [showCouponDialog, setShowCouponDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showPageDialog, setShowPageDialog] = useState(false);
  const [showBlogDialog, setShowBlogDialog] = useState(false);

  const [editingItem, setEditingItem] = useState(null);
  const fileInputRef = useRef(null);
  const [uploadStatus, setUploadStatus] = useState(null);

  useEffect(() => {
    if (isAdmin) fetchData();
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
      setCoupons(couponsData || []);
      setAnalytics(analyticsData);
      setCategories(categoriesData || []);
      setPrettyLinks(linksData || []);
      setPages(pagesData || []);
      setBlogPosts(blogData || []);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-[#ee922c]" /></div>;
  }
  if (!isAuthenticated || !isAdmin) {
    return <Navigate to="/login" replace />;
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadStatus({ loading: true, message: 'Processing CSV...' });
    try {
      await bulkUploadCoupons(file);
      setUploadStatus({ loading: false, success: true, message: 'Bulk Upload Successful' });
      toast.success('Inventory updated successfully');
      fetchData();
    } catch {
      setUploadStatus({ loading: false, success: false, message: 'Upload Failed' });
      toast.error('CSV format incorrect');
    }
  };

  const handleDelete = async (type, id, name) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      if (type === 'coupon') await deleteCoupon(id);
      if (type === 'category') await deleteCategory(id);
      if (type === 'link') await deletePrettyLink(id);
      if (type === 'page') await deletePage(id);
      if (type === 'blog') await deleteBlogPost(id);
      toast.success('Item removed');
      fetchData();
    } catch {
      toast.error('Delete failed');
    }
  };

  // Filtered coupons for search
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
    { id: 'upload', label: 'Bulk Import', icon: Upload },
    { id: 'links', label: 'Pretty Links', icon: Link2 },
    { id: 'pages', label: 'Pages', icon: FileText },
    { id: 'blog', label: 'Blog Posts', icon: BookOpen },
  ];

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20 md:pb-10" data-testid="admin-page">
      <AdminSEO />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">Admin Control Center</h1>
            <p className="text-gray-500 mt-1">Manage deals, categories, and site content</p>
          </div>
          <Button variant="outline" onClick={fetchData} disabled={loading} data-testid="refresh-data-btn">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh Data'}
          </Button>
        </header>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 bg-white p-2 rounded-2xl border shadow-sm">
          {tabs.map((item) => (
            <Button
              key={item.id}
              variant={activeTab === item.id ? 'default' : 'ghost'}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-2 rounded-xl transition-all ${activeTab === item.id ? 'bg-[#ee922c] hover:bg-[#d9811f]' : ''}`}
              data-testid={`tab-${item.id}`}
            >
              <item.icon className="w-4 h-4" />
              <span className="font-semibold">{item.label}</span>
            </Button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-white rounded-3xl border shadow-sm min-h-[500px] overflow-hidden">
          <AnimatePresence mode="wait">

            {/* DASHBOARD */}
            {activeTab === 'dashboard' && (
              <motion.div key="dashboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-8 space-y-8">
                <h2 className="text-2xl font-bold" data-testid="dashboard-heading">Overview</h2>
                {analytics ? (
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4" data-testid="analytics-grid">
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

            {/* DEALS & COUPONS */}
            {activeTab === 'coupons' && (
              <motion.div key="coupons" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h2 className="text-2xl font-bold">Deal Inventory</h2>
                  <Button onClick={() => { setEditingItem(null); setShowCouponDialog(true); }} className="bg-[#ee922c] hover:bg-[#d9811f]" data-testid="add-deal-btn">
                    <Plus className="w-4 h-4 mr-2" /> Add New Deal
                  </Button>
                </div>

                {/* Search Bar */}
                <div className="relative" data-testid="deal-search-wrapper">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search by title, brand, code, or category..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-10 h-12 rounded-xl"
                    data-testid="deal-search-input"
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {searchTerm && (
                  <p className="text-sm text-gray-500" data-testid="search-results-count">
                    {filteredCoupons.length} result{filteredCoupons.length !== 1 ? 's' : ''} for "{searchTerm}"
                  </p>
                )}

                <Table data-testid="deals-table">
                  <TableHeader>
                    <TableRow>
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
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden border">
                            {c.image_url ? <img src={c.image_url} className="w-full h-full object-cover" alt="" /> : <Tag className="w-full h-full p-3 text-gray-300" />}
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold max-w-[300px] truncate">{c.title}</TableCell>
                        <TableCell><span className="px-2 py-1 bg-gray-100 rounded-md text-xs font-bold">{c.brand_name}</span></TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-md text-xs font-bold ${c.offer_type === 'deal' ? 'bg-green-100 text-green-700' : c.offer_type === 'limited' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                            {c.offer_type === 'deal' ? 'Deal' : c.offer_type === 'limited' ? 'Limited' : 'Coupon'}
                          </span>
                        </TableCell>
                        <TableCell className="text-green-700 font-bold">{c.discounted_price ? `₹${c.discounted_price}` : '-'}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="outline" size="sm" onClick={() => { setEditingItem(c); setShowCouponDialog(true); }} data-testid={`edit-deal-${c.id}`}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="outline" size="sm" className="text-red-500" onClick={() => handleDelete('coupon', c.id, c.title)} data-testid={`delete-deal-${c.id}`}><Trash2 className="w-4 h-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredCoupons.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center py-12 text-gray-400">{searchTerm ? 'No deals match your search.' : 'No deals found. Add your first deal above.'}</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </motion.div>
            )}

            {/* CATEGORIES */}
            {activeTab === 'categories' && (
              <motion.div key="categories" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Categories</h2>
                  <Button onClick={() => { setEditingItem(null); setShowCategoryDialog(true); }} className="bg-blue-600 hover:bg-blue-700" data-testid="add-category-btn">
                    <Plus className="w-4 h-4 mr-2" /> Add Category
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categories.map((cat) => (
                    <div key={cat.id} className="border rounded-2xl p-4 flex items-center justify-between" data-testid={`category-card-${cat.id}`}>
                      <div className="flex items-center gap-4">
                        {cat.background_image_url ? (
                          <div className="w-14 h-14 rounded-xl overflow-hidden border bg-gray-100 flex-shrink-0">
                            <img src={cat.background_image_url} alt={cat.name} className="w-full h-full object-cover" />
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
                        <Button variant="outline" size="sm" onClick={() => { setEditingItem(cat); setShowCategoryDialog(true); }} data-testid={`edit-category-${cat.id}`}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm" className="text-red-500" onClick={() => handleDelete('category', cat.id, cat.name)} data-testid={`delete-category-${cat.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* BULK IMPORT */}
            {activeTab === 'upload' && (
              <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 space-y-6">
                <h2 className="text-2xl font-bold">Bulk Import Deals</h2>
                <div className="border-2 border-dashed rounded-3xl p-12 text-center" data-testid="bulk-upload-zone">
                  <FileSpreadsheet className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">Upload a CSV file with your deal inventory</p>
                  <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileUpload} className="hidden" data-testid="csv-file-input" />
                  <Button onClick={() => fileInputRef.current?.click()} className="bg-[#ee922c] hover:bg-[#d9811f]" data-testid="upload-csv-btn">
                    <Upload className="w-4 h-4 mr-2" /> Choose CSV File
                  </Button>
                  {uploadStatus && (
                    <div className={`mt-4 p-3 rounded-xl text-sm ${uploadStatus.success ? 'bg-green-50 text-green-700' : uploadStatus.loading ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
                      {uploadStatus.loading && <Loader2 className="w-4 h-4 animate-spin inline mr-2" />}
                      {uploadStatus.message}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* PRETTY LINKS */}
            {activeTab === 'links' && (
              <motion.div key="links" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Pretty Links</h2>
                  <Button onClick={() => { setEditingItem(null); setShowLinkDialog(true); }} className="bg-[#ee922c] hover:bg-[#d9811f]" data-testid="add-link-btn">
                    <Plus className="w-4 h-4 mr-2" /> Add Link
                  </Button>
                </div>
                <Table data-testid="links-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Slug</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Clicks</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prettyLinks.map((link) => (
                      <TableRow key={link.id}>
                        <TableCell className="font-mono text-sm text-blue-600">/{link.slug}</TableCell>
                        <TableCell className="max-w-[250px] truncate text-sm text-gray-500">{link.destination_url}</TableCell>
                        <TableCell className="font-semibold">{link.title || '-'}</TableCell>
                        <TableCell className="font-bold text-orange-600">{link.clicks || 0}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-md text-xs font-bold ${link.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {link.is_active !== false ? 'Active' : 'Inactive'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="outline" size="sm" onClick={() => { setEditingItem(link); setShowLinkDialog(true); }} data-testid={`edit-link-${link.id}`}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="outline" size="sm" className="text-red-500" onClick={() => handleDelete('link', link.id, link.slug)} data-testid={`delete-link-${link.id}`}><Trash2 className="w-4 h-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {prettyLinks.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center py-12 text-gray-400">No pretty links yet. Create your first one above.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </motion.div>
            )}

            {/* PAGES */}
            {activeTab === 'pages' && (
              <motion.div key="pages" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Static Pages</h2>
                  <Button onClick={() => { setEditingItem(null); setShowPageDialog(true); }} className="bg-[#ee922c] hover:bg-[#d9811f]" data-testid="add-page-btn">
                    <Plus className="w-4 h-4 mr-2" /> Add Page
                  </Button>
                </div>
                <Table data-testid="pages-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pages.map((pg) => (
                      <TableRow key={pg.id}>
                        <TableCell className="font-semibold">{pg.title}</TableCell>
                        <TableCell className="font-mono text-sm text-blue-600">/{pg.slug}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-md text-xs font-bold ${pg.is_published ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {pg.is_published ? 'Published' : 'Draft'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="outline" size="sm" onClick={() => { setEditingItem(pg); setShowPageDialog(true); }} data-testid={`edit-page-${pg.id}`}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="outline" size="sm" className="text-red-500" onClick={() => handleDelete('page', pg.id, pg.title)} data-testid={`delete-page-${pg.id}`}><Trash2 className="w-4 h-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {pages.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center py-12 text-gray-400">No pages yet. Create your first one above.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </motion.div>
            )}

            {/* BLOG */}
            {activeTab === 'blog' && (
              <motion.div key="blog" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Blog Posts</h2>
                  <Button onClick={() => { setEditingItem(null); setShowBlogDialog(true); }} className="bg-[#ee922c] hover:bg-[#d9811f]" data-testid="add-blog-btn">
                    <Plus className="w-4 h-4 mr-2" /> Add Post
                  </Button>
                </div>
                <Table data-testid="blog-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {blogPosts.map((post) => (
                      <TableRow key={post.id}>
                        <TableCell className="font-semibold">{post.title}</TableCell>
                        <TableCell className="font-mono text-sm text-blue-600">/{post.slug}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-md text-xs font-bold ${post.published ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {post.published ? 'Published' : 'Draft'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="outline" size="sm" onClick={() => { setEditingItem(post); setShowBlogDialog(true); }} data-testid={`edit-blog-${post.id}`}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="outline" size="sm" className="text-red-500" onClick={() => handleDelete('blog', post.id, post.title)} data-testid={`delete-blog-${post.id}`}><Trash2 className="w-4 h-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {blogPosts.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center py-12 text-gray-400">No blog posts yet. Create your first one above.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* ============ DIALOGS ============ */}

      {/* Coupon Dialog */}
      <Dialog open={showCouponDialog} onOpenChange={setShowCouponDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">{editingItem ? 'Edit Deal' : 'Add New Deal'}</DialogTitle>
            <DialogDescription>Fill in the details below to {editingItem ? 'update this' : 'create a new'} deal or coupon.</DialogDescription>
          </DialogHeader>
          <CouponForm item={editingItem} categories={categories} onSuccess={() => { setShowCouponDialog(false); fetchData(); }} />
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">{editingItem ? 'Edit Category' : 'Create Category'}</DialogTitle>
            <DialogDescription>Add or update a category with an optional background image.</DialogDescription>
          </DialogHeader>
          <CategoryForm item={editingItem} onSuccess={() => { setShowCategoryDialog(false); setEditingItem(null); fetchData(); }} />
        </DialogContent>
      </Dialog>

      {/* Pretty Link Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="max-w-lg rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">{editingItem ? 'Edit Link' : 'Add Pretty Link'}</DialogTitle>
            <DialogDescription>Create a short branded link that redirects to your affiliate URL.</DialogDescription>
          </DialogHeader>
          <PrettyLinkForm item={editingItem} onSuccess={() => { setShowLinkDialog(false); setEditingItem(null); fetchData(); }} />
        </DialogContent>
      </Dialog>

      {/* Page Dialog */}
      <Dialog open={showPageDialog} onOpenChange={setShowPageDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">{editingItem ? 'Edit Page' : 'Add New Page'}</DialogTitle>
            <DialogDescription>Create or edit a static page (Privacy Policy, About Us, etc.).</DialogDescription>
          </DialogHeader>
          <PageForm item={editingItem} onSuccess={() => { setShowPageDialog(false); setEditingItem(null); fetchData(); }} />
        </DialogContent>
      </Dialog>

      {/* Blog Dialog */}
      <Dialog open={showBlogDialog} onOpenChange={setShowBlogDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">{editingItem ? 'Edit Post' : 'Add Blog Post'}</DialogTitle>
            <DialogDescription>Write or edit a blog post for your site.</DialogDescription>
          </DialogHeader>
          <BlogForm item={editingItem} onSuccess={() => { setShowBlogDialog(false); setEditingItem(null); fetchData(); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ================================================================
   COUPON FORM
   ================================================================ */
function CouponForm({ item, categories, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState(item?.image_url || '');
  const [filePreview, setFilePreview] = useState(item?.image_url || null);

  const [form, setForm] = useState(item || {
    title: '', brand_name: '', category_name: '',
    original_price: '', discounted_price: '',
    affiliate_url: '', code: '', is_active: true, offer_type: 'coupon',
  });

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setFilePreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const uploadedUrl = await uploadImage(file);
      setImageUrl(uploadedUrl);
      toast.success('Image uploaded!');
    } catch {
      toast.error('Image upload failed. Preview kept — retry or clear.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const dealData = {
      ...form,
      original_price: form.original_price !== '' && form.original_price !== null ? parseFloat(form.original_price) : null,
      discounted_price: form.discounted_price !== '' && form.discounted_price !== null ? parseFloat(form.discounted_price) : null,
      image_url: imageUrl,
    };
    try {
      if (item) await updateCoupon(item.id, dealData);
      else await createCoupon(dealData);
      toast.success('Deal saved');
      onSuccess();
    } catch (error) {
      toast.error('Failed to save deal');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pt-4" data-testid="coupon-form">
      {/* Image Upload */}
      <div className="space-y-2">
        <Label className="text-xs font-bold uppercase tracking-widest text-gray-400">Deal Image</Label>
        <div className="relative group flex items-center justify-center w-full h-40 border-2 border-dashed border-gray-200 rounded-3xl hover:border-orange-400 hover:bg-orange-50/50 transition-all bg-gray-50 overflow-hidden">
          {filePreview ? (
            <>
              <img src={filePreview} alt="Preview" className="w-full h-full object-contain p-2" />
              <button type="button" onClick={() => { setImageUrl(''); setFilePreview(null); }} className="absolute top-2 right-2 bg-white/80 p-2 rounded-full shadow-lg text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" data-testid="clear-image-btn"><X size={16} /></button>
            </>
          ) : (
            <label htmlFor="dealImageUpload" className="cursor-pointer flex flex-col items-center justify-center p-6 space-y-2">
              <ImagePlus size={32} className="text-gray-300 group-hover:text-orange-500" />
              <span className="text-sm text-gray-600">{uploading ? 'Uploading...' : 'Click to upload deal image'}</span>
            </label>
          )}
          <input id="dealImageUpload" type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" disabled={uploading} data-testid="deal-image-input" />
          {uploading && <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 rounded-3xl"><Loader2 className="w-8 h-8 animate-spin text-orange-500" /></div>}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Title</Label>
        <Input placeholder="E.g. Flat 50% Off" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required className="h-12 rounded-xl" data-testid="deal-title-input" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Original Price</Label>
          <Input type="number" placeholder="0" value={form.original_price} onChange={e => setForm({...form, original_price: e.target.value})} className="h-12 rounded-xl" data-testid="deal-original-price" />
        </div>
        <div className="space-y-2">
          <Label>Discounted Price</Label>
          <Input type="number" placeholder="0" value={form.discounted_price} onChange={e => setForm({...form, discounted_price: e.target.value})} className="h-12 rounded-xl" data-testid="deal-discounted-price" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Brand</Label>
          <Input placeholder="Amazon, Myntra..." value={form.brand_name} onChange={e => setForm({...form, brand_name: e.target.value})} required className="h-12 rounded-xl" data-testid="deal-brand-input" />
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <select className="w-full h-12 px-3 py-2 border rounded-xl text-sm bg-white" value={form.category_name} onChange={e => setForm({...form, category_name: e.target.value})} required data-testid="deal-category-select">
            <option value="">Select Category</option>
            {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Offer Type</Label>
        <select className="w-full h-12 px-3 py-2 border rounded-xl text-sm bg-white" value={form.offer_type || 'coupon'} onChange={e => setForm({...form, offer_type: e.target.value})} data-testid="deal-offer-type-select">
          <option value="coupon">Coupon</option>
          <option value="deal">Deal</option>
          <option value="limited">Limited Time Offer</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label>Promo Code (Optional)</Label>
        <Input placeholder="E.g. SAVE50" value={form.code} onChange={e => setForm({...form, code: e.target.value})} className="h-12 rounded-xl font-mono uppercase" data-testid="deal-code-input" />
      </div>

      <div className="space-y-2">
        <Label>Affiliate URL</Label>
        <Input placeholder="https://..." value={form.affiliate_url} onChange={e => setForm({...form, affiliate_url: e.target.value})} required className="h-12 rounded-xl" data-testid="deal-url-input" />
      </div>

      <Button type="submit" className="w-full h-14 rounded-2xl bg-[#ee922c] hover:bg-[#d9811f] text-lg font-bold" disabled={loading || uploading} data-testid="save-deal-btn">
        {loading || uploading ? <><Loader2 className="animate-spin mr-2" /> Saving...</> : 'Save Deal Changes'}
      </Button>
    </form>
  );
}

/* ================================================================
   CATEGORY FORM
   ================================================================ */
function CategoryForm({ item, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState(item?.name || '');
  const [bgImageUrl, setBgImageUrl] = useState(item?.background_image_url || '');
  const [bgPreview, setBgPreview] = useState(item?.background_image_url || null);

  const handleBgUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setBgPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const uploadedUrl = await uploadImage(file);
      setBgImageUrl(uploadedUrl);
      toast.success('Background image uploaded!');
    } catch {
      toast.error('Image upload failed. Preview kept — retry or clear.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { name, background_image_url: bgImageUrl || null };
      if (item) await updateCategory(item.id, payload);
      else await createCategory(payload);
      toast.success(item ? 'Category updated' : 'Category created');
      onSuccess();
    } catch {
      toast.error('Failed to save category');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pt-4" data-testid="category-form">
      <div className="space-y-2">
        <Label>Category Label</Label>
        <Input placeholder="E.g., Fashion, Electronics" value={name} onChange={e => setName(e.target.value)} required className="h-14 rounded-2xl" data-testid="category-name-input" />
        <p className="text-xs text-gray-400">Slug will be generated automatically.</p>
      </div>

      {/* Background Image Upload */}
      <div className="space-y-2">
        <Label className="text-xs font-bold uppercase tracking-widest text-gray-400">Background Image</Label>
        <div className="relative group flex items-center justify-center w-full h-36 border-2 border-dashed border-gray-200 rounded-2xl hover:border-blue-400 hover:bg-blue-50/50 transition-all bg-gray-50 overflow-hidden">
          {bgPreview ? (
            <>
              <img src={bgPreview} alt="Background preview" className="w-full h-full object-cover" />
              <button type="button" onClick={() => { setBgImageUrl(''); setBgPreview(null); }} className="absolute top-2 right-2 bg-white/80 p-2 rounded-full shadow-lg text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" data-testid="clear-cat-bg-btn"><X size={16} /></button>
            </>
          ) : (
            <label htmlFor="catBgUpload" className="cursor-pointer flex flex-col items-center justify-center p-6 space-y-2">
              <ImagePlus size={28} className="text-gray-300 group-hover:text-blue-500" />
              <span className="text-sm text-gray-600">{uploading ? 'Uploading...' : 'Click to upload background'}</span>
            </label>
          )}
          <input id="catBgUpload" type="file" accept="image/*" onChange={handleBgUpload} className="absolute inset-0 opacity-0 cursor-pointer" disabled={uploading} data-testid="cat-bg-input" />
          {uploading && <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 rounded-2xl"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>}
        </div>
      </div>

      <Button type="submit" className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 font-bold" disabled={loading || uploading} data-testid="save-category-btn">
        {loading ? <Loader2 className="animate-spin" /> : (item ? 'Update Category' : 'Confirm & Add Category')}
      </Button>
    </form>
  );
}

/* ================================================================
   PRETTY LINK FORM
   ================================================================ */
function PrettyLinkForm({ item, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    slug: item?.slug || '',
    destination_url: item?.destination_url || '',
    title: item?.title || '',
    description: item?.description || '',
    is_active: item?.is_active !== false,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (item) await updatePrettyLink(item.id, form);
      else await createPrettyLink(form);
      toast.success(item ? 'Link updated' : 'Link created');
      onSuccess();
    } catch (error) {
      toast.error('Failed to save link');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pt-4" data-testid="link-form">
      <div className="space-y-2">
        <Label>Slug</Label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">/go/</span>
          <Input placeholder="amazon-deals" value={form.slug} onChange={e => setForm({...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')})} required className="h-12 rounded-xl font-mono" data-testid="link-slug-input" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Destination URL</Label>
        <Input placeholder="https://www.amazon.in?tag=disccart" value={form.destination_url} onChange={e => setForm({...form, destination_url: e.target.value})} required className="h-12 rounded-xl" data-testid="link-url-input" />
      </div>
      <div className="space-y-2">
        <Label>Title (optional)</Label>
        <Input placeholder="Amazon India Deals" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="h-12 rounded-xl" data-testid="link-title-input" />
      </div>
      <div className="space-y-2">
        <Label>Description (optional)</Label>
        <Input placeholder="Short description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="h-12 rounded-xl" data-testid="link-desc-input" />
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="linkActive" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})} className="rounded" />
        <Label htmlFor="linkActive" className="cursor-pointer">Active</Label>
      </div>
      <Button type="submit" className="w-full h-14 rounded-2xl bg-[#ee922c] hover:bg-[#d9811f] text-lg font-bold" disabled={loading} data-testid="save-link-btn">
        {loading ? <Loader2 className="animate-spin" /> : (item ? 'Update Link' : 'Create Link')}
      </Button>
    </form>
  );
}

/* ================================================================
   PAGE FORM
   ================================================================ */
function PageForm({ item, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: item?.title || '',
    slug: item?.slug || '',
    meta_description: item?.meta_description || '',
    meta_keywords: item?.meta_keywords || '',
    content: item?.content || '',
    is_published: item?.is_published !== false,
  });

  const autoSlug = (title) => title.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/[\s]+/g, '-');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const payload = { ...form, slug: form.slug || autoSlug(form.title) };
    try {
      if (item) await updatePage(item.id, payload);
      else await createPage(payload);
      toast.success(item ? 'Page updated' : 'Page created');
      onSuccess();
    } catch (error) {
      toast.error('Failed to save page');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pt-4" data-testid="page-form">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Title</Label>
          <Input placeholder="Privacy Policy" value={form.title} onChange={e => { setForm({...form, title: e.target.value, slug: form.slug || autoSlug(e.target.value)}); }} required className="h-12 rounded-xl" data-testid="page-title-input" />
        </div>
        <div className="space-y-2">
          <Label>Slug</Label>
          <Input placeholder="privacy-policy" value={form.slug} onChange={e => setForm({...form, slug: e.target.value})} className="h-12 rounded-xl font-mono" data-testid="page-slug-input" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Meta Description</Label>
        <Input placeholder="SEO description" value={form.meta_description} onChange={e => setForm({...form, meta_description: e.target.value})} className="h-12 rounded-xl" data-testid="page-meta-input" />
      </div>
      <div className="space-y-2">
        <Label>Content (Markdown)</Label>
        <Textarea placeholder="# Page Title&#10;&#10;Write your content here..." value={form.content} onChange={e => setForm({...form, content: e.target.value})} className="min-h-[200px] rounded-xl" data-testid="page-content-input" />
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="pagePublished" checked={form.is_published} onChange={e => setForm({...form, is_published: e.target.checked})} className="rounded" />
        <Label htmlFor="pagePublished" className="cursor-pointer">Published</Label>
      </div>
      <Button type="submit" className="w-full h-14 rounded-2xl bg-[#ee922c] hover:bg-[#d9811f] text-lg font-bold" disabled={loading} data-testid="save-page-btn">
        {loading ? <Loader2 className="animate-spin" /> : (item ? 'Update Page' : 'Create Page')}
      </Button>
    </form>
  );
}

/* ================================================================
   BLOG FORM
   ================================================================ */
function BlogForm({ item, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: item?.title || '',
    slug: item?.slug || '',
    content: item?.content || '',
    meta_description: item?.meta_description || '',
    published: item?.published !== false,
  });

  const autoSlug = (title) => title.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/[\s]+/g, '-');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const payload = { ...form, slug: form.slug || autoSlug(form.title) };
    try {
      if (item) await updateBlogPost(item.id, payload);
      else await createBlogPost(payload);
      toast.success(item ? 'Post updated' : 'Post created');
      onSuccess();
    } catch (error) {
      toast.error('Failed to save post');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pt-4" data-testid="blog-form">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Title</Label>
          <Input placeholder="10 Best Shopping Hacks" value={form.title} onChange={e => { setForm({...form, title: e.target.value, slug: form.slug || autoSlug(e.target.value)}); }} required className="h-12 rounded-xl" data-testid="blog-title-input" />
        </div>
        <div className="space-y-2">
          <Label>Slug</Label>
          <Input placeholder="10-best-shopping-hacks" value={form.slug} onChange={e => setForm({...form, slug: e.target.value})} className="h-12 rounded-xl font-mono" data-testid="blog-slug-input" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Meta Description</Label>
        <Input placeholder="Brief SEO summary" value={form.meta_description} onChange={e => setForm({...form, meta_description: e.target.value})} className="h-12 rounded-xl" data-testid="blog-meta-input" />
      </div>
      <div className="space-y-2">
        <Label>Content (Markdown)</Label>
        <Textarea placeholder="# Blog Post&#10;&#10;Write your post here..." value={form.content} onChange={e => setForm({...form, content: e.target.value})} className="min-h-[200px] rounded-xl" data-testid="blog-content-input" />
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="blogPublished" checked={form.published} onChange={e => setForm({...form, published: e.target.checked})} className="rounded" />
        <Label htmlFor="blogPublished" className="cursor-pointer">Published</Label>
      </div>
      <Button type="submit" className="w-full h-14 rounded-2xl bg-[#ee922c] hover:bg-[#d9811f] text-lg font-bold" disabled={loading} data-testid="save-blog-btn">
        {loading ? <Loader2 className="animate-spin" /> : (item ? 'Update Post' : 'Create Post')}
      </Button>
    </form>
  );
}
