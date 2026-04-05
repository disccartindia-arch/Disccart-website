import { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Tag, Upload, Link2, FileText, BookOpen,
  Plus, Pencil, Trash2, Check, X, Loader2, FileSpreadsheet, 
  AlertCircle, ExternalLink, Copy, Eye, ImagePlus, Sparkles
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '../components/ui/dialog';
import {
  getCoupons, createCoupon, updateCoupon, deleteCoupon,
  bulkUploadCoupons, getAnalyticsOverview, getCategories,
  createCategory, updateCategory, deleteCategory,
  getPrettyLinks, createPrettyLink, updatePrettyLink, deletePrettyLink,
  getPages, createPage, updatePage, deletePage,
  getBlogPosts, createBlogPost, updateBlogPost, deleteBlogPost,
  uploadImage // Imported from your updated api.js
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
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Dialog States
  const [showCouponDialog, setShowCouponDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  
  // Edit State
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
      const [
        couponsData, 
        analyticsData, 
        categoriesData, 
        linksData, 
        pagesData, 
        blogData
      ] = await Promise.all([
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
      toast.error('Failed to load administrative data');
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

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadStatus({ loading: true, message: 'Processing CSV...' });
    try {
      await bulkUploadCoupons(file);
      setUploadStatus({ loading: false, success: true, message: 'Bulk Upload Successful' });
      toast.success('Inventory updated successfully');
      fetchData();
    } catch (err) {
      setUploadStatus({ loading: false, success: false, message: 'Upload Failed' });
      toast.error('CSV format incorrect');
    }
  };

  const handleDelete = async (type, id, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) return;
    
    try {
      if (type === 'coupon') await deleteCoupon(id);
      if (type === 'category') await deleteCategory(id);
      if (type === 'link') await deletePrettyLink(id);
      if (type === 'page') await deletePage(id);
      if (type === 'blog') await deleteBlogPost(id);
      
      toast.success('Item removed');
      fetchData();
    } catch (error) {
      toast.error('Delete operation failed');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20 md:pb-10">
      <AdminSEO />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">Admin Control Center</h1>
            <p className="text-gray-500 mt-1">Manage deals, categories, and site content</p>
          </div>
          <div className="flex items-center gap-3">
             <Button variant="outline" onClick={fetchData} disabled={loading}>
               {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh Data'}
             </Button>
          </div>
        </header>
        
        {/* Navigation Sidebar/Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 bg-white p-2 rounded-2xl border shadow-sm">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'coupons', label: 'Deals & Coupons', icon: Tag },
            { id: 'categories', label: 'Categories', icon: Plus },
            { id: 'upload', label: 'Bulk Import', icon: Upload },
            { id: 'links', label: 'Pretty Links', icon: Link2 },
            { id: 'pages', label: 'Pages', icon: FileText },
            { id: 'blog', label: 'Blog Posts', icon: BookOpen },
          ].map((item) => (
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

        {/* Dynamic Content Area */}
        <div className="bg-white rounded-3xl border shadow-sm min-h-[500px] overflow-hidden">
          <AnimatePresence mode="wait">
            
            {/* DASHBOARD TAB */}
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6"
              >
                <div className="p-8 bg-gradient-to-br from-white to-gray-50 border rounded-3xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <Tag size={80} />
                  </div>
                  <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Total Inventory</p>
                  <p className="text-5xl font-black mt-2 text-gray-900">{analytics?.total_coupons || 0}</p>
                  <p className="text-xs text-gray-500 mt-4 flex items-center gap-1">
                    <Check className="w-3 h-3 text-green-500" /> {analytics?.active_coupons || 0} currently active
                  </p>
                </div>

                <div className="p-8 bg-gradient-to-br from-white to-gray-50 border rounded-3xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <ExternalLink size={80} />
                  </div>
                  <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">User Engagement</p>
                  <p className="text-5xl font-black mt-2 text-[#ee922c]">{analytics?.total_clicks || 0}</p>
                  <p className="text-xs text-gray-500 mt-4 font-medium">Total outbound redirects</p>
                </div>

                <div className="p-8 bg-gradient-to-br from-white to-gray-50 border rounded-3xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <Plus size={80} />
                  </div>
                  <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Taxonomy</p>
                  <p className="text-5xl font-black mt-2 text-blue-600">{categories.length}</p>
                  <p className="text-xs text-gray-500 mt-4 font-medium">Defined active categories</p>
                </div>
              </motion.div>
            )}

            {/* DEALS TAB */}
            {activeTab === 'coupons' && (
              <motion.div key="coupons" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Deal Inventory</h2>
                  <Button onClick={() => { setEditingItem(null); setShowCouponDialog(true); }} className="bg-[#ee922c] hover:bg-[#d9811f]">
                    <Plus className="w-4 h-4 mr-2" /> Add New Deal
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Preview</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coupons.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden border">
                            {c.image_url ? <img src={c.image_url} className="w-full h-full object-cover" /> : <Tag className="w-full h-full p-3 text-gray-300" />}
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold max-w-[300px] truncate">{c.title}</TableCell>
                        <TableCell><span className="px-2 py-1 bg-gray-100 rounded-md text-xs font-bold">{c.brand_name}</span></TableCell>
                        <TableCell className="text-green-700 font-bold">₹{c.discounted_price || '-'}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="outline" size="sm" onClick={() => { setEditingItem(c); setShowCouponDialog(true); }}><Pencil className="w-4 h-4" /></Button>
                          <Button variant="outline" size="sm" className="text-red-600 border-red-100 hover:bg-red-50" onClick={() => handleDelete('coupon', c.id, c.title)}><Trash2 className="w-4 h-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </motion.div>
            )}

            {/* CATEGORIES TAB */}
            {activeTab === 'categories' && (
              <motion.div key="categories" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Manage Categories</h2>
                  <Button onClick={() => setShowCategoryDialog(true)} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" /> New Category
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((cat) => (
                      <TableRow key={cat.id}>
                        <TableCell className="font-bold text-lg">{cat.name}</TableCell>
                        <TableCell className="text-gray-400 font-mono text-xs">{cat.slug}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDelete('category', cat.id, cat.name)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </motion.div>
            )}

            {/* UPLOAD TAB */}
            {activeTab === 'upload' && (
              <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-20 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-orange-50 text-[#ee922c] rounded-full flex items-center justify-center mb-6">
                  <FileSpreadsheet size={40} />
                </div>
                <h2 className="text-2xl font-bold mb-2">Bulk CSV Import</h2>
                <p className="text-gray-500 max-w-sm mb-8">Upload a CSV file containing deals to process them all at once. Ensure your headers match the database schema.</p>
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept=".csv" />
                <Button size="lg" className="px-10 h-14 rounded-2xl bg-[#ee922c]" onClick={() => fileInputRef.current.click()}>
                  {uploadStatus?.loading ? <Loader2 className="animate-spin mr-2" /> : <Plus className="mr-2" />}
                  Select CSV File
                </Button>
                {uploadStatus && <p className={`mt-6 font-bold ${uploadStatus.success ? 'text-green-600' : 'text-red-500'}`}>{uploadStatus.message}</p>}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* --- FORM DIALOGS --- */}

      {/* 1. COUPON/DEAL DIALOG */}
      <Dialog open={showCouponDialog} onOpenChange={setShowCouponDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">{editingItem ? 'Edit Existing Deal' : 'Add New Deal'}</DialogTitle>
          </DialogHeader>
          <CouponForm 
            item={editingItem} 
            categories={categories} 
            onSuccess={() => { setShowCouponDialog(false); fetchData(); }} 
          />
        </DialogContent>
      </Dialog>

      {/* 2. CATEGORY DIALOG */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Create Category</DialogTitle>
          </DialogHeader>
          <CategoryForm 
            onSuccess={() => { setShowCategoryDialog(false); fetchData(); }} 
          />
        </DialogContent>
      </Dialog>

    </div>
  );
}
// Find and replace the function CouponForm({ ... }) { ... } in AdminPage.jsx with this:

function CouponForm({ item, categories, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false); // State to show image upload progress
  
  // 1. New State for Image Handling
  const [imageUrl, setImageUrl] = useState(item?.image_url || ''); // Stores the final URL to save
  const [filePreview, setFilePreview] = useState(item?.image_url || null); // For local preview

  // Standard Form State
  const [form, setForm] = useState(item || { 
    title: '', 
    brand_name: '', 
    category_name: '', 
    original_price: '', 
    discounted_price: '', 
    affiliate_url: '',
    code: '', // Preserve existing fields
    is_active: true
  });
  
  // 2. Handle File Selection and Upload
  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Show a local preview instantly for better UX
    setFilePreview(URL.createObjectURL(file));
    setUploading(true);

    try {
      // Send the file to our new API function from Step 1
      const uploadedUrl = await uploadImage(file);
      // Update the state with the permanent URL from the server
      setImageUrl(uploadedUrl);
      toast.success('Image uploaded successfully!');
    } catch (error) {
      toast.error('Image upload failed. Try again.');
      setFilePreview(null); // Clear preview on error
    } finally {
      setUploading(false);
    }
  };

  const clearImage = () => {
    setImageUrl('');
    setFilePreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const dealData = {
      ...form, // Keep all standard form data
      
      // Convert prices to numbers, or default to 0
      original_price: parseFloat(form.original_price) || 0,
      discounted_price: parseFloat(form.discounted_price) || 0,
      
      // 3. Include the finalized Image URL in the payload
      image_url: imageUrl, 
    };

    try {
      if (item) await updateCoupon(item.id, dealData);
      else await createCoupon(dealData);
      toast.success('Deal changes saved');
      onSuccess();
    } catch (error) {
      toast.error('Failed to save deal. Check console.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pt-4">
      
      {/* =============================================================== */}
      {/* VISUAL IMAGE UPLOAD SECTION (The fix you requested) */}
      {/* =============================================================== */}
      <div className="mb-6 space-y-2">
        <Label className="text-xs font-bold uppercase tracking-widest text-gray-400">Deal Image</Label>
        
        {/* Dotted upload box */}
        <div className="relative group flex items-center justify-center w-full h-40 border-2 border-dashed border-gray-200 rounded-3xl hover:border-orange-400 hover:bg-orange-50/50 transition-all bg-gray-50 overflow-hidden">
          
          {filePreview ? (
            // If image is selected, show preview with a delete button
            <>
              <img src={filePreview} alt="Preview" className="w-full h-full object-contain p-2" />
              <button
                type="button"
                onClick={clearImage}
                className="absolute top-2 right-2 bg-white/80 p-2 rounded-full shadow-lg hover:bg-white text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={16} />
              </button>
            </>
          ) : (
            // If no image, show the upload icon
            <label htmlFor="dealImageUpload" className="cursor-pointer flex flex-col items-center justify-center text-center p-6 space-y-2">
              <ImagePlus size={32} className="text-gray-300 group-hover:text-orange-500" />
              <span className="text-sm text-gray-600 group-hover:text-orange-700">
                {uploading ? 'Uploading...' : 'Click or drag to upload deal image'}
              </span>
              <span className="text-xs text-gray-400">JPEG, PNG, WEBP (Max 2MB)</span>
            </label>
          )}

          {/* Hidden File Input (Actual functionality) */}
          <input
            id="dealImageUpload"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="absolute inset-0 opacity-0 cursor-pointer"
            disabled={uploading} // Prevent uploading another while one is in progress
          />

          {/* Loading Overlay */}
          {uploading && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center backdrop-blur-sm z-10 rounded-3xl">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          )}
        </div>
      </div>
      {/* =============================================================== */}

      {/* Rest of the form remains unchanged */}
      <div className="space-y-2">
        <Label>Title</Label>
        <Input placeholder="E.g. Flat 50% Off On Smartphones" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required className="h-12 rounded-xl" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Original Price (₹)</Label>
          <Input type="number" placeholder="0" value={form.original_price} onChange={e => setForm({...form, original_price: e.target.value})} className="h-12 rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label>Discounted Price (₹)</Label>
          <Input type="number" placeholder="0" value={form.discounted_price} onChange={e => setForm({...form, discounted_price: e.target.value})} className="h-12 rounded-xl" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Brand</Label>
          <Input placeholder="Amazon, Myntra..." value={form.brand_name} onChange={e => setForm({...form, brand_name: e.target.value})} required className="h-12 rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <select 
            className="w-full h-12 px-3 py-2 border rounded-xl text-sm bg-white" 
            value={form.category_name} 
            onChange={e => setForm({...form, category_name: e.target.value})}
            required
          >
            <option value="">Select Category</option>
            {categories.map(cat => <option key={cat.id || cat._id} value={cat.name}>{cat.name}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Promo Code (Optional)</Label>
        <Input placeholder="E.g. SAVE50" value={form.code} onChange={e => setForm({...form, code: e.target.value})} className="h-12 rounded-xl font-mono uppercase" />
      </div>

      <div className="space-y-2">
        <Label>Affiliate URL</Label>
        <Input placeholder="https://..." value={form.affiliate_url} onChange={e => setForm({...form, affiliate_url: e.target.value})} required className="h-12 rounded-xl" />
      </div>

      <Button type="submit" className="w-full h-14 rounded-2xl bg-[#ee922c] hover:bg-[#d9811f] text-lg font-bold" disabled={loading || uploading}>
        {loading || uploading ? (
          <><Loader2 className="animate-spin mr-2" /> Saving...</>
        ) : (
          <>Save Deal Changes</>
        )}
      </Button>
    </form>
  );
}
/**
 * SIMPLE CATEGORY FORM
 */
function CategoryForm({ onSuccess }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createCategory({ name });
      toast.success('Category created successfully');
      onSuccess();
    } catch {
      toast.error('Failed to create category');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pt-4">
      <div className="space-y-2">
        <Label>Category Label</Label>
        <Input 
          placeholder="E.g., Fashion, Electronics, Food" 
          value={name} 
          onChange={e => setName(e.target.value)} 
          required 
          className="h-14 rounded-2xl"
        />
        <p className="text-xs text-gray-400">The slug will be generated automatically.</p>
      </div>
      <Button type="submit" className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 font-bold" disabled={loading}>
        {loading ? <Loader2 className="animate-spin" /> : 'Confirm & Add Category'}
      </Button>
    </form>
  );
}