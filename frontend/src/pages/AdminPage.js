import { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Tag, Upload, BarChart3, Plus, Pencil, Trash2,
  Check, X, Loader2, FileSpreadsheet, AlertCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
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
  bulkUploadCoupons, getAnalyticsOverview, getCategories
} from '../lib/api';

export default function AdminPage() {
  const { user, isAuthenticated, isAdmin, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [coupons, setCoupons] = useState([]);
  const [categories, setCategories] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
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
      const [couponsData, analyticsData, categoriesData] = await Promise.all([
        getCoupons({ limit: 100 }),
        getAnalyticsOverview(),
        getCategories()
      ]);
      setCoupons(couponsData);
      setAnalytics(analyticsData);
      setCategories(categoriesData);
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
        <Loader2 className="w-8 h-8 text-[#FF8C00] animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return <Navigate to="/login" replace />;
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadStatus({ loading: true, message: 'Uploading...' });
    try {
      const result = await bulkUploadCoupons(file);
      setUploadStatus({
        loading: false,
        success: true,
        message: `Successfully added ${result.added} coupons`,
        errors: result.errors
      });
      toast.success(`${result.added} coupons added successfully`);
      fetchData();
    } catch (error) {
      setUploadStatus({
        loading: false,
        success: false,
        message: error.response?.data?.detail || 'Upload failed'
      });
      toast.error('Upload failed');
    }
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteCoupon = async (couponId) => {
    if (!window.confirm('Are you sure you want to delete this coupon?')) return;
    try {
      await deleteCoupon(couponId);
      toast.success('Coupon deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete coupon');
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'coupons', label: 'Coupons', icon: Tag },
    { id: 'upload', label: 'CSV Upload', icon: Upload }
  ];

  return (
    <div className="pb-20 md:pb-8" data-testid="admin-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display font-bold text-3xl text-gray-900">Admin Panel</h1>
            <p className="text-gray-500">Manage deals and coupons</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto hide-scrollbar">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm whitespace-nowrap transition-all ${
                activeTab === id
                  ? 'bg-[#FF8C00] text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-[#FF8C00]'
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-6" data-testid="stat-total-coupons">
                <p className="text-sm text-gray-500 mb-1">Total Coupons</p>
                <p className="font-display font-black text-3xl text-gray-900">
                  {analytics?.total_coupons || 0}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6" data-testid="stat-active-coupons">
                <p className="text-sm text-gray-500 mb-1">Active Coupons</p>
                <p className="font-display font-black text-3xl text-[#228B22]">
                  {analytics?.active_coupons || 0}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6" data-testid="stat-total-clicks">
                <p className="text-sm text-gray-500 mb-1">Total Clicks</p>
                <p className="font-display font-black text-3xl text-[#FF8C00]">
                  {analytics?.total_clicks || 0}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6" data-testid="stat-users">
                <p className="text-sm text-gray-500 mb-1">Total Users</p>
                <p className="font-display font-black text-3xl text-gray-900">
                  {analytics?.total_users || 0}
                </p>
              </div>
            </div>

            {/* Top Brands */}
            {analytics?.top_brands && analytics.top_brands.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-[#FF8C00]" />
                  Top Performing Brands
                </h3>
                <div className="space-y-3">
                  {analytics.top_brands.map((brand, index) => (
                    <div key={brand.name} className="flex items-center gap-4">
                      <span className="w-6 h-6 rounded-full bg-orange-100 text-[#FF8C00] text-xs font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span className="flex-1 font-medium">{brand.name}</span>
                      <span className="text-gray-500">{brand.clicks} clicks</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Coupons Tab */}
        {activeTab === 'coupons' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Add Button */}
            <div className="flex justify-end">
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-[#FF8C00] hover:bg-[#E67E00]" data-testid="add-coupon-btn">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Coupon
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingCoupon ? 'Edit Coupon' : 'Add New Coupon'}</DialogTitle>
                  </DialogHeader>
                  <CouponForm
                    coupon={editingCoupon}
                    categories={categories}
                    onSuccess={() => {
                      setShowAddDialog(false);
                      setEditingCoupon(null);
                      fetchData();
                    }}
                    onCancel={() => {
                      setShowAddDialog(false);
                      setEditingCoupon(null);
                    }}
                  />
                </DialogContent>
              </Dialog>
            </div>

            {/* Coupons Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Clicks</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                      </TableCell>
                    </TableRow>
                  ) : coupons.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        No coupons yet. Add your first coupon!
                      </TableCell>
                    </TableRow>
                  ) : (
                    coupons.map((coupon) => (
                      <TableRow key={coupon.id}>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {coupon.title}
                        </TableCell>
                        <TableCell>{coupon.brand_name}</TableCell>
                        <TableCell>
                          {coupon.code ? (
                            <code className="bg-gray-100 px-2 py-1 rounded text-sm">
                              {coupon.code}
                            </code>
                          ) : (
                            <span className="text-gray-400">No code</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {coupon.discount_type === 'percentage'
                            ? `${coupon.discount_value}%`
                            : coupon.discount_type === 'flat'
                            ? `₹${coupon.discount_value}`
                            : 'Deal'}
                        </TableCell>
                        <TableCell>{coupon.clicks}</TableCell>
                        <TableCell>
                          {coupon.is_active ? (
                            <span className="inline-flex items-center gap-1 text-green-600 text-sm">
                              <Check className="w-4 h-4" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-gray-400 text-sm">
                              <X className="w-4 h-4" /> Inactive
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingCoupon(coupon);
                                setShowAddDialog(true);
                              }}
                              data-testid={`edit-coupon-${coupon.id}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-600"
                              onClick={() => handleDeleteCoupon(coupon.id)}
                              data-testid={`delete-coupon-${coupon.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </motion.div>
        )}

        {/* CSV Upload Tab */}
        {activeTab === 'upload' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-2xl mx-auto"
          >
            <div className="bg-white rounded-xl border border-gray-200 p-8">
              <div className="text-center mb-8">
                <FileSpreadsheet className="w-16 h-16 text-[#FF8C00] mx-auto mb-4" />
                <h2 className="font-display font-bold text-2xl text-gray-900 mb-2">
                  Bulk Upload Coupons
                </h2>
                <p className="text-gray-500">Upload a CSV file to add multiple coupons at once</p>
              </div>

              {/* Upload Area */}
              <div
                className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-[#FF8C00] transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                data-testid="csv-upload-area"
              >
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="font-medium text-gray-900 mb-1">Click to upload CSV</p>
                <p className="text-sm text-gray-500">or drag and drop</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileUpload}
                  data-testid="csv-file-input"
                />
              </div>

              {/* Upload Status */}
              {uploadStatus && (
                <div className={`mt-6 p-4 rounded-xl ${
                  uploadStatus.loading
                    ? 'bg-blue-50 text-blue-700'
                    : uploadStatus.success
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-700'
                }`}>
                  <div className="flex items-center gap-2">
                    {uploadStatus.loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : uploadStatus.success ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <AlertCircle className="w-5 h-5" />
                    )}
                    <span className="font-medium">{uploadStatus.message}</span>
                  </div>
                  {uploadStatus.errors && uploadStatus.errors.length > 0 && (
                    <div className="mt-4 text-sm space-y-1">
                      <p className="font-medium">Errors:</p>
                      {uploadStatus.errors.map((error, i) => (
                        <p key={i}>{error}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* CSV Format Guide */}
              <div className="mt-8 p-4 bg-gray-50 rounded-xl">
                <h3 className="font-semibold text-gray-900 mb-2">CSV Format</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Your CSV should have the following columns:
                </p>
                <code className="block text-xs bg-gray-900 text-green-400 p-3 rounded-lg overflow-x-auto">
                  title,description,code,discount_type,discount_value,brand_name,category_name,original_price,discounted_price,affiliate_url,image_url,is_featured,is_verified,tags
                </code>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// Coupon Form Component
function CouponForm({ coupon, categories, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    title: coupon?.title || '',
    description: coupon?.description || '',
    code: coupon?.code || '',
    discount_type: coupon?.discount_type || 'percentage',
    discount_value: coupon?.discount_value || '',
    brand_name: coupon?.brand_name || '',
    category_name: coupon?.category_name || '',
    original_price: coupon?.original_price || '',
    discounted_price: coupon?.discounted_price || '',
    affiliate_url: coupon?.affiliate_url || '',
    image_url: coupon?.image_url || '',
    is_featured: coupon?.is_featured || false,
    is_verified: coupon?.is_verified !== false,
    tags: coupon?.tags?.join(', ') || ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = {
        ...formData,
        discount_value: formData.discount_value ? parseFloat(formData.discount_value) : null,
        original_price: formData.original_price ? parseFloat(formData.original_price) : null,
        discounted_price: formData.discounted_price ? parseFloat(formData.discounted_price) : null,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean)
      };

      if (coupon) {
        await updateCoupon(coupon.id, payload);
        toast.success('Coupon updated');
      } else {
        await createCoupon(payload);
        toast.success('Coupon created');
      }
      onSuccess();
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to save coupon');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
            data-testid="coupon-title-input"
          />
        </div>

        <div className="col-span-2">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="brand_name">Brand Name *</Label>
          <Input
            id="brand_name"
            value={formData.brand_name}
            onChange={(e) => setFormData({ ...formData, brand_name: e.target.value })}
            required
            data-testid="coupon-brand-input"
          />
        </div>

        <div>
          <Label htmlFor="category_name">Category *</Label>
          <Select
            value={formData.category_name}
            onValueChange={(value) => setFormData({ ...formData, category_name: value })}
          >
            <SelectTrigger data-testid="coupon-category-select">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="code">Coupon Code</Label>
          <Input
            id="code"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
            placeholder="Optional"
            data-testid="coupon-code-input"
          />
        </div>

        <div>
          <Label htmlFor="discount_type">Discount Type</Label>
          <Select
            value={formData.discount_type}
            onValueChange={(value) => setFormData({ ...formData, discount_type: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">Percentage (%)</SelectItem>
              <SelectItem value="flat">Flat Amount (₹)</SelectItem>
              <SelectItem value="deal">Deal (No specific discount)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="discount_value">Discount Value</Label>
          <Input
            id="discount_value"
            type="number"
            value={formData.discount_value}
            onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
            placeholder="e.g., 50"
          />
        </div>

        <div>
          <Label htmlFor="affiliate_url">Affiliate URL *</Label>
          <Input
            id="affiliate_url"
            type="url"
            value={formData.affiliate_url}
            onChange={(e) => setFormData({ ...formData, affiliate_url: e.target.value })}
            required
            data-testid="coupon-url-input"
          />
        </div>

        <div>
          <Label htmlFor="original_price">Original Price</Label>
          <Input
            id="original_price"
            type="number"
            value={formData.original_price}
            onChange={(e) => setFormData({ ...formData, original_price: e.target.value })}
            placeholder="₹"
          />
        </div>

        <div>
          <Label htmlFor="discounted_price">Discounted Price</Label>
          <Input
            id="discounted_price"
            type="number"
            value={formData.discounted_price}
            onChange={(e) => setFormData({ ...formData, discounted_price: e.target.value })}
            placeholder="₹"
          />
        </div>

        <div className="col-span-2">
          <Label htmlFor="image_url">Image URL</Label>
          <Input
            id="image_url"
            type="url"
            value={formData.image_url}
            onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
            placeholder="https://..."
          />
        </div>

        <div className="col-span-2">
          <Label htmlFor="tags">Tags (comma separated)</Label>
          <Input
            id="tags"
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            placeholder="shoes, sneakers, fashion"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_featured"
            checked={formData.is_featured}
            onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
            className="w-4 h-4"
          />
          <Label htmlFor="is_featured" className="mb-0">Featured Deal</Label>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_verified"
            checked={formData.is_verified}
            onChange={(e) => setFormData({ ...formData, is_verified: e.target.checked })}
            className="w-4 h-4"
          />
          <Label htmlFor="is_verified" className="mb-0">Verified</Label>
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className="flex-1 bg-[#FF8C00] hover:bg-[#E67E00]"
          data-testid="save-coupon-btn"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (coupon ? 'Update' : 'Create')}
        </Button>
      </div>
    </form>
  );
}
