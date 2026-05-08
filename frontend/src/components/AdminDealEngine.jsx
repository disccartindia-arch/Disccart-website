import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Rocket, Link2, Loader2, Sparkles, Send, Globe, Copy, Check,
  Settings, BarChart3, FileText, Clock, Eye, RefreshCcw, Trash2,
  ChevronDown, ExternalLink, Image as ImageIcon, AlertCircle
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import api from '../lib/api';

// ===================== API HELPERS =====================

const deApi = {
  extract: (url) => api.post('/deal-engine/extract', { url }).then(r => r.data),
  caption: (product) => api.post('/deal-engine/caption', { product }).then(r => r.data),
  publishTelegram: (data) => api.post('/deal-engine/publish-telegram', data).then(r => r.data),
  publishWebsite: (data) => api.post('/deal-engine/publish-website', data).then(r => r.data),
  getDeals: (params) => api.get('/deal-engine/deals', { params }).then(r => r.data),
  updateStatus: (id, status) => api.patch(`/deal-engine/deals/${id}/status`, { status }).then(r => r.data),
  getAnalytics: () => api.get('/deal-engine/analytics').then(r => r.data),
  getSettings: () => api.get('/deal-engine/settings').then(r => r.data),
  saveSettings: (data) => api.patch('/deal-engine/settings', data).then(r => r.data),
  testTelegram: (data) => api.post('/deal-engine/test-telegram', data).then(r => r.data),
  queue: (urls) => api.post('/deal-engine/queue', { urls }).then(r => r.data),
};

// ===================== MAIN COMPONENT =====================

export default function AdminDealEngine() {
  const [activeView, setActiveView] = useState('create');

  const views = [
    { id: 'create', label: 'Create Deal', icon: Rocket },
    { id: 'queue', label: 'Deal Queue', icon: FileText },
    { id: 'deals', label: 'My Deals', icon: Eye },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 md:p-6 space-y-4" data-testid="deal-engine-tab">
      <div className="flex items-center gap-3 mb-2">
        <div className="bg-gradient-to-br from-[#ee922c] to-[#d9811f] p-2.5 rounded-xl">
          <Rocket className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-black text-gray-900">Deal Engine</h2>
          <p className="text-xs text-gray-500">Paste URL → Auto-generate → Publish in seconds</p>
        </div>
      </div>

      {/* View tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {views.map(v => (
          <button
            key={v.id}
            onClick={() => setActiveView(v.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeView === v.id ? 'bg-[#ee922c] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            data-testid={`de-tab-${v.id}`}
          >
            <v.icon className="w-3.5 h-3.5" />
            {v.label}
          </button>
        ))}
      </div>

      <div className="bg-gray-50 rounded-2xl border min-h-[400px]">
        {activeView === 'create' && <CreateDealView />}
        {activeView === 'queue' && <DealQueueView />}
        {activeView === 'deals' && <DealsListView />}
        {activeView === 'analytics' && <AnalyticsView />}
        {activeView === 'settings' && <SettingsView />}
      </div>
    </motion.div>
  );
}

// ===================== CREATE DEAL VIEW =====================

function CreateDealView() {
  const [url, setUrl] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [product, setProduct] = useState(null);
  const [captions, setCaptions] = useState(null);
  const [step, setStep] = useState(1); // 1=input, 2=preview, 3=captions, 4=publish

  // Editable form fields
  const [form, setForm] = useState({
    title: '', description: '', brand_name: '', category_name: '',
    original_price: '', discounted_price: '', discount_pct: 0,
    image_url: '', affiliate_url: '', source_url: '', platform: '',
    telegram_caption: '', status: 'published', code: ''
  });

  const handleExtract = async () => {
    if (!url.trim()) { toast.error('Paste a product URL'); return; }
    setExtracting(true);
    try {
      const res = await deApi.extract(url.trim());
      if (res.success && res.product) {
        const p = res.product;
        setProduct(p);
        setForm(prev => ({
          ...prev,
          title: p.title || '',
          brand_name: p.title?.split(' ')[0] || '',
          category_name: p.category || '',
          original_price: p.original_price || '',
          discounted_price: p.current_price || '',
          discount_pct: p.discount_pct || 0,
          image_url: p.image_url || '',
          affiliate_url: p.affiliate_url || '',
          source_url: p.source_url || url,
          platform: p.platform || '',
        }));
        setStep(2);
        toast.success('Product extracted!');
      } else {
        toast.error('Could not extract. Fill details manually.');
        setStep(2);
      }
    } catch (err) {
      toast.error('Extraction failed. Check the URL.');
    } finally {
      setExtracting(false);
    }
  };

  const handleGenerateCaption = async () => {
    setGenerating(true);
    try {
      const productData = {
        title: form.title,
        current_price: form.discounted_price ? parseInt(form.discounted_price) : 0,
        original_price: form.original_price ? parseInt(form.original_price) : 0,
        discount_pct: form.discount_pct,
        features: product?.features || [],
        platform: form.platform,
      };
      const res = await deApi.caption(productData);
      if (res.success && res.captions) {
        setCaptions(res.captions);
        setForm(prev => ({
          ...prev,
          description: res.captions.website_description || prev.description,
          title: res.captions.seo_title || prev.title,
          telegram_caption: res.captions.telegram_caption || '',
        }));
        setStep(3);
        toast.success('Captions generated!');
      } else {
        toast.error(res.error || 'Caption generation failed');
      }
    } catch {
      toast.error('Caption generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handlePublishWebsite = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setPublishing(true);
    try {
      const res = await deApi.publishWebsite({
        title: form.title,
        description: form.description,
        brand_name: form.brand_name,
        category_name: form.category_name,
        original_price: form.original_price ? parseInt(form.original_price) : null,
        discounted_price: form.discounted_price ? parseInt(form.discounted_price) : null,
        discount_pct: form.discount_pct,
        image_url: form.image_url,
        affiliate_url: form.affiliate_url,
        source_url: form.source_url,
        platform: form.platform,
        code: form.code,
        offer_type: form.code ? 'coupon' : 'deal',
        status: form.status,
      });
      if (res.success) {
        toast.success('Published to website!');
        // Also try telegram if caption exists
        return res.deal_id;
      }
    } catch {
      toast.error('Publish failed');
    } finally {
      setPublishing(false);
    }
    return null;
  };

  const handlePublishTelegram = async (dealId) => {
    if (!form.telegram_caption) { toast.error('Generate caption first'); return; }
    try {
      const res = await deApi.publishTelegram({
        caption: form.telegram_caption,
        image_url: form.image_url,
        affiliate_url: form.affiliate_url,
        deal_id: dealId,
      });
      if (res.success) {
        toast.success('Sent to Telegram!');
      } else {
        toast.error(res.error || 'Telegram failed — check settings');
      }
    } catch {
      toast.error('Telegram send failed');
    }
  };

  const handlePublishAll = async () => {
    const dealId = await handlePublishWebsite();
    if (dealId && form.telegram_caption) {
      await handlePublishTelegram(dealId);
    }
    if (dealId) {
      setStep(4);
    }
  };

  const handleReset = () => {
    setUrl('');
    setProduct(null);
    setCaptions(null);
    setForm({
      title: '', description: '', brand_name: '', category_name: '',
      original_price: '', discounted_price: '', discount_pct: 0,
      image_url: '', affiliate_url: '', source_url: '', platform: '',
      telegram_caption: '', status: 'published', code: ''
    });
    setStep(1);
  };

  return (
    <div className="p-4 md:p-6 space-y-5" data-testid="de-create-view">
      {/* Progress bar */}
      <div className="flex items-center gap-1">
        {['Paste URL', 'Preview', 'Caption', 'Done'].map((label, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className={`h-1.5 w-full rounded-full transition-all ${step > i ? 'bg-[#ee922c]' : 'bg-gray-200'}`} />
            <span className={`text-[10px] font-bold ${step > i ? 'text-[#ee922c]' : 'text-gray-400'}`}>{label}</span>
          </div>
        ))}
      </div>

      {/* STEP 1 — URL Input */}
      {step === 1 && (
        <div className="space-y-4" data-testid="de-step-url">
          <div className="bg-white rounded-xl border p-5 space-y-3">
            <Label className="text-sm font-bold">Paste Product URL</Label>
            <p className="text-xs text-gray-400">Supports Amazon India and Flipkart links</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://www.amazon.in/dp/..."
                  className="pl-9"
                  data-testid="de-url-input"
                  onKeyDown={e => e.key === 'Enter' && handleExtract()}
                />
              </div>
              <Button
                onClick={handleExtract}
                disabled={extracting}
                className="bg-[#ee922c] hover:bg-[#d9811f] text-white min-w-[100px]"
                data-testid="de-extract-btn"
              >
                {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4 mr-1" />}
                {extracting ? 'Fetching...' : 'Fetch'}
              </Button>
            </div>
          </div>

          <button onClick={() => setStep(2)} className="text-xs text-gray-400 hover:text-gray-600 underline">
            Skip extraction — fill manually
          </button>
        </div>
      )}

      {/* STEP 2 — Preview & Edit */}
      {step >= 2 && step < 4 && (
        <div className="space-y-4" data-testid="de-step-preview">
          {/* Product preview card */}
          {form.image_url && (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="flex gap-3 p-3">
                <img src={form.image_url} alt="" className="w-20 h-20 rounded-lg object-contain bg-gray-50 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold text-[#ee922c] uppercase">{form.platform}</span>
                  <h3 className="text-sm font-bold text-gray-900 line-clamp-2">{form.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    {form.discounted_price && <span className="text-sm font-black text-[#3c7b48]">₹{Number(form.discounted_price).toLocaleString()}</span>}
                    {form.original_price && form.original_price !== form.discounted_price && (
                      <span className="text-xs text-gray-400 line-through">₹{Number(form.original_price).toLocaleString()}</span>
                    )}
                    {form.discount_pct > 0 && (
                      <span className="text-xs font-bold text-white bg-[#3c7b48] px-1.5 py-0.5 rounded">{form.discount_pct}% OFF</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Editable form */}
          <div className="bg-white rounded-xl border p-4 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" /> Deal Details
              <span className="text-[10px] text-gray-400 ml-auto">All fields editable</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <Label className="text-xs">Title</Label>
                <Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Deal title" data-testid="de-title" />
              </div>
              <div>
                <Label className="text-xs">Brand</Label>
                <Input value={form.brand_name} onChange={e => setForm({...form, brand_name: e.target.value})} placeholder="Brand" />
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <Input value={form.category_name} onChange={e => setForm({...form, category_name: e.target.value})} placeholder="Category" />
              </div>
              <div>
                <Label className="text-xs">Sale Price (₹)</Label>
                <Input type="number" value={form.discounted_price} onChange={e => setForm({...form, discounted_price: e.target.value})} placeholder="0" />
              </div>
              <div>
                <Label className="text-xs">Original Price (₹)</Label>
                <Input type="number" value={form.original_price} onChange={e => setForm({...form, original_price: e.target.value})} placeholder="0" />
              </div>
              <div>
                <Label className="text-xs">Coupon Code (optional)</Label>
                <Input value={form.code} onChange={e => setForm({...form, code: e.target.value})} placeholder="SAVE10" />
              </div>
              <div>
                <Label className="text-xs">Affiliate URL</Label>
                <Input value={form.affiliate_url} onChange={e => setForm({...form, affiliate_url: e.target.value})} placeholder="https://..." />
              </div>
              <div>
                <Label className="text-xs">Image URL</Label>
                <Input value={form.image_url} onChange={e => setForm({...form, image_url: e.target.value})} placeholder="https://..." />
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="published">Publish Now</option>
                  <option value="draft">Save as Draft</option>
                  <option value="scheduled">Schedule</option>
                </select>
              </div>
            </div>
          </div>

          {/* Caption section */}
          {step >= 3 && captions && (
            <div className="bg-white rounded-xl border p-4 space-y-3" data-testid="de-caption-section">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#ee922c]" /> AI Captions
                </h3>
                <Button variant="ghost" size="sm" onClick={handleGenerateCaption} disabled={generating} className="text-xs">
                  <RefreshCcw className={`w-3 h-3 mr-1 ${generating ? 'animate-spin' : ''}`} /> Regenerate
                </Button>
              </div>

              <div>
                <Label className="text-xs">Website Description</Label>
                <Textarea
                  value={form.description}
                  onChange={e => setForm({...form, description: e.target.value})}
                  className="min-h-[60px] text-sm"
                  data-testid="de-description"
                />
              </div>

              <div>
                <Label className="text-xs">Telegram Caption</Label>
                <Textarea
                  value={form.telegram_caption}
                  onChange={e => setForm({...form, telegram_caption: e.target.value})}
                  className="min-h-[80px] text-sm font-mono"
                  data-testid="de-telegram-caption"
                />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {step === 2 && (
              <Button
                onClick={handleGenerateCaption}
                disabled={generating || !form.title}
                className="bg-purple-600 hover:bg-purple-700 text-white"
                data-testid="de-generate-caption-btn"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
                {generating ? 'Generating...' : 'Generate AI Caption'}
              </Button>
            )}

            {step >= 3 && (
              <>
                <Button
                  onClick={handlePublishAll}
                  disabled={publishing || !form.title}
                  className="bg-[#3c7b48] hover:bg-[#2d6c3a] text-white"
                  data-testid="de-publish-all-btn"
                >
                  {publishing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Rocket className="w-4 h-4 mr-1" />}
                  {publishing ? 'Publishing...' : 'Publish (Website + Telegram)'}
                </Button>

                <Button
                  onClick={handlePublishWebsite}
                  disabled={publishing || !form.title}
                  variant="outline"
                  data-testid="de-publish-web-btn"
                >
                  <Globe className="w-4 h-4 mr-1" /> Website Only
                </Button>
              </>
            )}

            <Button variant="ghost" onClick={handleReset} className="text-gray-500 ml-auto">
              <RefreshCcw className="w-4 h-4 mr-1" /> Start Over
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4 — Success */}
      {step === 4 && (
        <div className="text-center py-12 space-y-4" data-testid="de-step-done">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-xl font-black text-gray-900">Deal Published!</h3>
          <p className="text-sm text-gray-500">Your deal is now live on DISCCART</p>
          <Button onClick={handleReset} className="bg-[#ee922c] hover:bg-[#d9811f] text-white">
            <Rocket className="w-4 h-4 mr-2" /> Create Another Deal
          </Button>
        </div>
      )}
    </div>
  );
}

// ===================== DEALS LIST VIEW =====================

function DealsListView() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    loadDeals();
  }, [filter]);

  const loadDeals = async () => {
    setLoading(true);
    try {
      const params = { limit: 50 };
      if (filter) params.status = filter;
      const res = await deApi.getDeals(params);
      setDeals(res.deals || []);
    } catch {
      toast.error('Failed to load deals');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await deApi.updateStatus(id, status);
      toast.success(`Status → ${status}`);
      loadDeals();
    } catch {
      toast.error('Update failed');
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4" data-testid="de-deals-view">
      <div className="flex items-center gap-2">
        <h3 className="font-bold text-sm">Engine Deals</h3>
        <div className="flex gap-1 ml-auto">
          {['', 'published', 'draft', 'scheduled'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${filter === f ? 'bg-[#ee922c] text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              {f || 'All'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : deals.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No deals yet. Create one from the Deal Engine!</div>
      ) : (
        <div className="space-y-2">
          {deals.map(deal => (
            <div key={deal.id} className="bg-white rounded-xl border p-3 flex items-center gap-3">
              {deal.image_url ? (
                <img src={deal.image_url} alt="" className="w-12 h-12 rounded-lg object-contain bg-gray-50 flex-shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0"><ImageIcon className="w-5 h-5 text-gray-300" /></div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{deal.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    deal.status === 'published' ? 'bg-green-100 text-green-700' :
                    deal.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{deal.status || 'published'}</span>
                  <span className="text-[10px] text-gray-400">{deal.source_platform}</span>
                  {deal.discounted_price && <span className="text-[10px] font-bold text-[#3c7b48]">₹{deal.discounted_price?.toLocaleString()}</span>}
                </div>
              </div>
              <select
                value={deal.status || 'published'}
                onChange={e => handleStatusChange(deal.id, e.target.value)}
                className="border rounded-lg px-1.5 py-1 text-[10px] bg-white"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===================== ANALYTICS VIEW =====================

function AnalyticsView() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    deApi.getAnalytics()
      .then(setStats)
      .catch(() => toast.error('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  const cards = [
    { label: 'Total Deals', value: stats?.total_deals_posted || 0, color: 'bg-blue-50 text-blue-700' },
    { label: 'Published', value: stats?.published || 0, color: 'bg-green-50 text-green-700' },
    { label: 'Drafts', value: stats?.drafts || 0, color: 'bg-gray-50 text-gray-700' },
    { label: 'Scheduled', value: stats?.scheduled || 0, color: 'bg-purple-50 text-purple-700' },
    { label: 'Telegram Posts', value: stats?.total_telegram_posts || 0, color: 'bg-cyan-50 text-cyan-700' },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4" data-testid="de-analytics-view">
      <h3 className="font-bold text-sm">Deal Engine Analytics</h3>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map(c => (
          <div key={c.label} className={`${c.color} rounded-xl p-4 text-center`}>
            <p className="text-2xl font-black">{c.value}</p>
            <p className="text-[10px] font-bold mt-1 opacity-70">{c.label}</p>
          </div>
        ))}
      </div>
      {stats?.top_clicked?.length > 0 && (
        <div className="bg-white rounded-xl border p-4">
          <h4 className="text-xs font-bold mb-2">Top Clicked Deals</h4>
          {stats.top_clicked.map((d, i) => (
            <div key={i} className="flex justify-between text-xs py-1 border-b last:border-0">
              <span className="text-gray-600">Deal {d.deal_id?.slice(-6)}</span>
              <span className="font-bold">{d.clicks} clicks</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===================== SETTINGS VIEW =====================

function SettingsView() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    amazon_affiliate_tag: '',
    flipkart_affiliate_id: '',
    telegram_bot_token: '',
    telegram_channel_id: '',
  });

  useEffect(() => {
    deApi.getSettings()
      .then(data => {
        setSettings(prev => ({
          ...prev,
          amazon_affiliate_tag: data.amazon_affiliate_tag || '',
          flipkart_affiliate_id: data.flipkart_affiliate_id || '',
          telegram_channel_id: data.telegram_channel_id || '',
          // Don't overwrite token with masked value
          telegram_bot_token: '',
          telegram_configured: data.telegram_configured || false,
        }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Only send token if user typed a new one
      const payload = { ...settings };
      if (!payload.telegram_bot_token) {
        delete payload.telegram_bot_token;
      }
      delete payload.telegram_configured;
      await deApi.saveSettings(payload);
      toast.success('Settings saved');
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-4" data-testid="de-settings-view">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm">Deal Engine Settings</h3>
        <Button onClick={handleSave} disabled={saving} size="sm" className="bg-[#ee922c] hover:bg-[#d9811f]" data-testid="de-settings-save">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
        </Button>
      </div>

      <div className="bg-white rounded-xl border p-4 space-y-3">
        <h4 className="text-xs font-bold text-gray-500 uppercase">Affiliate Tags</h4>
        <div>
          <Label className="text-xs">Amazon Affiliate Tag</Label>
          <Input value={settings.amazon_affiliate_tag} onChange={e => setSettings({...settings, amazon_affiliate_tag: e.target.value})} placeholder="e.g. disccart-21" data-testid="de-amazon-tag" />
        </div>
        <div>
          <Label className="text-xs">Flipkart Affiliate ID</Label>
          <Input value={settings.flipkart_affiliate_id} onChange={e => setSettings({...settings, flipkart_affiliate_id: e.target.value})} placeholder="e.g. disccart" />
        </div>
      </div>

      <div className="bg-white rounded-xl border p-4 space-y-3">
        <h4 className="text-xs font-bold text-gray-500 uppercase">Telegram Integration</h4>
        <div>
          <Label className="text-xs">Bot Token {settings.telegram_configured && <span className="text-green-600 text-[10px]">(configured)</span>}</Label>
          <Input type="password" value={settings.telegram_bot_token} onChange={e => setSettings({...settings, telegram_bot_token: e.target.value})} placeholder={settings.telegram_configured ? "Already set — enter new value to change" : "123456:ABC-DEF..."} data-testid="de-tg-token" />
        </div>
        <div>
          <Label className="text-xs">Channel ID</Label>
          <Input value={settings.telegram_channel_id} onChange={e => setSettings({...settings, telegram_channel_id: e.target.value})} placeholder="@yourchannel or -100123..." data-testid="de-tg-channel" />
        </div>
        <p className="text-[10px] text-gray-400">Get your bot token from @BotFather on Telegram. Channel ID is your channel username (e.g., @disccartdeals) or numeric ID.</p>
        <TelegramTestButton token={settings.telegram_bot_token} channelId={settings.telegram_channel_id} />
      </div>
    </div>
  );
}

// ===================== TELEGRAM TEST BUTTON =====================

function TelegramTestButton({ token, channelId }) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  const handleTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const res = await deApi.testTelegram({ bot_token: token, channel_id: channelId });
      setResult(res);
      if (res.success) {
        toast.success(`Connected! Bot: @${res.bot_name} → ${res.channel_name}`);
      } else {
        toast.error(res.error || 'Connection failed');
      }
    } catch {
      toast.error('Test failed — check your credentials');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="pt-2 space-y-2" data-testid="tg-test-section">
      <Button onClick={handleTest} disabled={testing} variant="outline" size="sm" className="w-full" data-testid="tg-test-btn">
        {testing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
        {testing ? 'Testing...' : 'Test Telegram Connection'}
      </Button>
      {result && (
        <div className={`text-xs p-2 rounded-lg ${result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {result.success ? (
            <span>Connected to <strong>{result.channel_name}</strong> via @{result.bot_name}</span>
          ) : (
            <span>{result.error}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ===================== DEAL QUEUE VIEW =====================

function DealQueueView() {
  const [urlsText, setUrlsText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState(0);

  const handleProcessQueue = async () => {
    const urls = urlsText.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
    if (urls.length === 0) { toast.error('Paste at least one valid URL'); return; }
    setProcessing(true);
    setResults([]);
    try {
      const res = await deApi.queue(urls);
      setResults(res.results || []);
      const ok = (res.results || []).filter(r => r.success).length;
      toast.success(`Processed ${ok}/${urls.length} deals`);
    } catch {
      toast.error('Queue processing failed');
    } finally {
      setProcessing(false);
    }
  };

  const toggleApproval = (idx) => {
    setResults(prev => prev.map((r, i) => i === idx ? { ...r, approved: !r.approved } : r));
  };

  const handleBulkPublish = async (includeTelegram = false) => {
    const approved = results.filter(r => r.approved && r.success);
    if (approved.length === 0) { toast.error('No approved deals'); return; }
    setPublishing(true);
    setPublishProgress(0);
    let done = 0;
    for (const item of approved) {
      try {
        const p = item.product || {};
        const res = await deApi.publishWebsite({
          title: item.captions?.seo_title || p.title || 'Untitled Deal',
          description: item.captions?.website_description || '',
          brand_name: p.title?.split(' ')[0] || '',
          category_name: p.category || '',
          original_price: p.original_price || null,
          discounted_price: p.current_price || null,
          discount_pct: p.discount_pct || 0,
          image_url: p.image_url || '',
          affiliate_url: p.affiliate_url || '',
          source_url: p.source_url || '',
          platform: p.platform || '',
          status: 'published',
        });

        if (res.success && includeTelegram && item.captions?.telegram_caption) {
          await deApi.publishTelegram({
            caption: item.captions.telegram_caption,
            image_url: p.image_url || '',
            affiliate_url: p.affiliate_url || '',
            deal_id: res.deal_id,
          });
        }

        done++;
      } catch {}
      setPublishProgress(Math.round((done / approved.length) * 100));
    }
    toast.success(`Published ${done} deals`);
    setResults([]);
    setUrlsText('');
    setPublishing(false);
    setPublishProgress(0);
  };

  return (
    <div className="p-4 md:p-6 space-y-4" data-testid="de-queue-view">
      <h3 className="font-bold text-sm">Deal Queue — Batch Processing</h3>
      <p className="text-xs text-gray-500">Paste multiple product URLs (one per line). The engine will extract data and generate captions for all of them.</p>

      {results.length === 0 ? (
        <div className="space-y-3">
          <textarea
            value={urlsText}
            onChange={e => setUrlsText(e.target.value)}
            placeholder="https://www.amazon.in/dp/XXXXXXXXXX&#10;https://www.flipkart.com/product-name/p/...&#10;https://www.amazon.in/dp/YYYYYYYYYY"
            className="w-full border rounded-xl p-3 text-sm min-h-[120px] bg-white resize-y focus:ring-2 focus:ring-[#ee922c]/30 outline-none font-mono"
            data-testid="queue-urls-input"
          />
          <div className="flex items-center gap-2">
            <Button
              onClick={handleProcessQueue}
              disabled={processing}
              className="bg-[#ee922c] hover:bg-[#d9811f] text-white"
              data-testid="queue-process-btn"
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Rocket className="w-4 h-4 mr-1" />}
              {processing ? 'Processing...' : `Process ${urlsText.split('\n').filter(u => u.trim().startsWith('http')).length} URLs`}
            </Button>
            <span className="text-[10px] text-gray-400">Max 15 URLs per batch</span>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Progress bar during publish */}
          {publishing && (
            <div className="bg-orange-50 rounded-xl p-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#ee922c] mb-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Publishing... {publishProgress}%
              </div>
              <div className="w-full bg-orange-200 rounded-full h-1.5">
                <div className="bg-[#ee922c] h-1.5 rounded-full transition-all" style={{ width: `${publishProgress}%` }} />
              </div>
            </div>
          )}

          {/* Results list */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto" data-testid="queue-results">
            {results.map((item, idx) => (
              <div key={idx} className={`bg-white rounded-xl border p-3 flex items-start gap-3 ${!item.success ? 'opacity-50' : ''}`}>
                <input
                  type="checkbox"
                  checked={item.approved}
                  onChange={() => toggleApproval(idx)}
                  className="mt-1 rounded"
                  disabled={!item.success}
                />
                <div className="flex-1 min-w-0">
                  {item.success ? (
                    <>
                      <p className="text-sm font-semibold truncate">{item.product?.title || 'Untitled'}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] font-bold text-[#ee922c]">{item.product?.platform}</span>
                        {item.product?.current_price > 0 && (
                          <span className="text-[10px] font-bold text-[#3c7b48]">₹{item.product.current_price.toLocaleString()}</span>
                        )}
                        {item.product?.discount_pct > 0 && (
                          <span className="text-[10px] bg-green-100 text-green-700 px-1 rounded">{item.product.discount_pct}% OFF</span>
                        )}
                        <span className="text-[10px] text-gray-400">{item.product?.extraction_method === 'ai' ? 'AI extracted' : 'Scraped'}</span>
                      </div>
                      {item.captions?.telegram_caption && (
                        <p className="text-[10px] text-gray-400 mt-1 truncate">{item.captions.telegram_caption.slice(0, 80)}...</p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-red-500">{item.error || 'Failed'}: {item.url?.slice(0, 50)}</p>
                  )}
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${item.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {item.success ? 'OK' : 'Fail'}
                </span>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => handleBulkPublish(false)}
              disabled={publishing || !results.some(r => r.approved)}
              className="bg-[#3c7b48] hover:bg-[#2d6c3a] text-white"
              data-testid="queue-publish-web"
            >
              <Globe className="w-4 h-4 mr-1" />
              Publish to Website ({results.filter(r => r.approved && r.success).length})
            </Button>
            <Button
              onClick={() => handleBulkPublish(true)}
              disabled={publishing || !results.some(r => r.approved)}
              variant="outline"
              data-testid="queue-publish-all"
            >
              <Send className="w-4 h-4 mr-1" />
              Publish + Telegram
            </Button>
            <Button variant="ghost" onClick={() => { setResults([]); setUrlsText(''); }} className="text-gray-500 ml-auto">
              <RefreshCcw className="w-4 h-4 mr-1" /> Start Over
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
