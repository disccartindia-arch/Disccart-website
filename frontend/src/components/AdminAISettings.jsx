import { useState, useEffect } from 'react';
import { Loader2, Plus, Trash2, Save, Brain, MessageCircle, Palette, Users, Crown, Bell, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { getAISettings, updateAISettings, getCategories } from '../lib/api';

export default function AdminAISettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [activeSection, setActiveSection] = useState('reply_chain');

  const [settings, setSettings] = useState({
    reply_chain: [
      { label: 'Reply 1 (Greeting)', prompt: 'Welcome! I\'m DealBot. What kind of deals are you looking for today?' },
      { label: 'Reply 2 (Follow-up)', prompt: 'Great choice! Let me find the best deals for you.' },
      { label: 'Reply 3 (Recommendation)', prompt: 'Here are some top picks based on your interest.' },
      { label: 'Reply 4+ (Ongoing)', prompt: 'Anything else I can help you find? I can search by category, brand, or price range.' }
    ],
    prompt_templates: {
      greeting: '', product_recommendation: '', fallback: '',
      urgency: '', upsell: '', deal_alert: ''
    },
    category_tones: {},
    personality: {
      tone: 50, length: 'medium', aggressiveness: 'balanced',
      emoji_usage: true, promo_intensity: 50
    },
    engagement: {
      re_engagement_message: 'You left something behind! Check these deals before they expire.',
      exit_intent_message: 'Wait! Before you go, here\'s an exclusive deal just for you.',
      inactivity_message: 'Still there? I found some new deals you might like!',
      inactivity_seconds: 30,
      deal_alert_message: 'New deals just dropped! Want me to show you?',
      personalized_greeting: true
    },
    prime_membership: {
      enabled: false, tier_label: 'Prime Member Deal',
      non_member_teaser: 'This is an exclusive deal! Upgrade to see the full price.',
      member_unlock: 'Exclusive deal unlocked! Here\'s your special price.',
      badge_label: 'PRIME', badge_color: '#F5A623', badge_icon: 'crown'
    },
    notifications: {
      alert_frequency: 'daily',
      wishlist_suggestions: true,
      price_drop_message: 'Price dropped on an item in your wishlist!',
      limited_stock_message: 'Hurry! Limited stock available on this deal.'
    }
  });

  useEffect(() => {
    Promise.all([
      getAISettings(),
      getCategories()
    ]).then(([aiData, cats]) => {
      if (aiData && Object.keys(aiData).length > 1) {
        setSettings(prev => deepMerge(prev, aiData));
      }
      setCategories(cats || []);
    }).catch(() => {
      toast.error('Failed to load AI settings');
    }).finally(() => setLoading(false));
  }, []);

  const deepMerge = (target, source) => {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (key === '_id') continue;
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAISettings(settings);
      toast.success('AI Settings saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const updateNested = (path, value) => {
    setSettings(prev => {
      const parts = path.split('.');
      const updated = { ...prev };
      let current = updated;
      for (let i = 0; i < parts.length - 1; i++) {
        current[parts[i]] = { ...current[parts[i]] };
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = value;
      return updated;
    });
  };

  const sections = [
    { id: 'reply_chain', label: 'Conversation Flow', icon: MessageCircle },
    { id: 'templates', label: 'Prompt Templates', icon: BookOpen },
    { id: 'category_tones', label: 'Category Tones', icon: Palette },
    { id: 'personality', label: 'AI Personality', icon: Brain },
    { id: 'engagement', label: 'Engagement Hooks', icon: Users },
    { id: 'prime', label: 'Prime Membership', icon: Crown },
    { id: 'notifications', label: 'Notifications', icon: Bell }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <motion.div key="ai-settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 md:p-8 space-y-6" data-testid="ai-settings-tab">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold">AI Settings</h2>
          <p className="text-sm text-gray-500 mt-0.5">Configure DealBot behavior, personality, and engagement</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-[#ee922c] hover:bg-[#d9811f]" data-testid="ai-save-btn">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Save All Settings
        </Button>
      </div>

      {/* Section nav */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeSection === s.id
                ? 'bg-[#ee922c] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            data-testid={`ai-section-${s.id}`}
          >
            <s.icon className="w-3.5 h-3.5" />
            {s.label}
          </button>
        ))}
      </div>

      <div className="bg-gray-50 rounded-2xl border p-5 md:p-6 min-h-[400px]">
        {/* Section 1 — Conversation Flow */}
        {activeSection === 'reply_chain' && (
          <div className="space-y-4" data-testid="section-reply-chain">
            <h3 className="font-bold text-lg">Chatbot Conversation Flow</h3>
            <p className="text-sm text-gray-500">Define sequential replies. The chatbot delivers each in order. The last reply repeats for all subsequent turns.</p>
            {settings.reply_chain.map((reply, idx) => (
              <div key={idx} className="bg-white rounded-xl border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Input
                    value={reply.label}
                    onChange={e => {
                      const updated = [...settings.reply_chain];
                      updated[idx] = { ...updated[idx], label: e.target.value };
                      updateNested('reply_chain', updated);
                    }}
                    className="text-sm font-bold w-auto max-w-[200px] h-8"
                    placeholder="Label"
                  />
                  {settings.reply_chain.length > 1 && (
                    <Button
                      variant="ghost" size="sm" className="text-red-500"
                      onClick={() => updateNested('reply_chain', settings.reply_chain.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <Textarea
                  value={reply.prompt}
                  onChange={e => {
                    const updated = [...settings.reply_chain];
                    updated[idx] = { ...updated[idx], prompt: e.target.value };
                    updateNested('reply_chain', updated);
                  }}
                  placeholder="Reply prompt..."
                  className="min-h-[60px] text-sm"
                  data-testid={`reply-chain-${idx}`}
                />
              </div>
            ))}
            <Button
              variant="outline" size="sm"
              onClick={() => updateNested('reply_chain', [...settings.reply_chain, { label: `Reply ${settings.reply_chain.length + 1}`, prompt: '' }])}
            >
              <Plus className="w-4 h-4 mr-1" /> Add Reply Step
            </Button>
          </div>
        )}

        {/* Section 2 — Prompt Templates */}
        {activeSection === 'templates' && (
          <div className="space-y-4" data-testid="section-templates">
            <h3 className="font-bold text-lg">Prompt Templates Library</h3>
            <p className="text-sm text-gray-500">Editable prompt blocks injected into AI calls at runtime.</p>
            {[
              { key: 'greeting', label: 'Greeting' },
              { key: 'product_recommendation', label: 'Product Recommendation' },
              { key: 'fallback', label: 'Fallback (No Results)' },
              { key: 'urgency', label: 'Urgency' },
              { key: 'upsell', label: 'Upsell' },
              { key: 'deal_alert', label: 'Deal Alert' }
            ].map(t => (
              <div key={t.key} className="bg-white rounded-xl border p-4 space-y-2">
                <Label className="text-sm font-bold">{t.label}</Label>
                <Textarea
                  value={settings.prompt_templates[t.key] || ''}
                  onChange={e => updateNested(`prompt_templates.${t.key}`, e.target.value)}
                  placeholder={`${t.label} prompt template...`}
                  className="min-h-[60px] text-sm"
                  data-testid={`template-${t.key}`}
                />
              </div>
            ))}
          </div>
        )}

        {/* Section 3 — Category Tones */}
        {activeSection === 'category_tones' && (
          <div className="space-y-4" data-testid="section-category-tones">
            <h3 className="font-bold text-lg">Category-Level Tone</h3>
            <p className="text-sm text-gray-500">Set the AI tone for each category when recommending deals.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {categories.map(cat => (
                <div key={cat.id} className="bg-white rounded-xl border p-3 flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">{cat.name}</span>
                  <select
                    value={settings.category_tones[cat.name] || 'friendly'}
                    onChange={e => updateNested(`category_tones.${cat.name}`, e.target.value)}
                    className="border rounded-lg px-2 py-1.5 text-xs font-medium bg-white focus:ring-1 focus:ring-[#ee922c]"
                    data-testid={`tone-${cat.slug || cat.name}`}
                  >
                    <option value="technical">Technical</option>
                    <option value="trendy">Trendy</option>
                    <option value="urgent">Urgent</option>
                    <option value="friendly">Friendly</option>
                    <option value="luxury">Luxury</option>
                    <option value="budget">Budget-focused</option>
                  </select>
                </div>
              ))}
              {categories.length === 0 && <p className="text-sm text-gray-400 col-span-2">No categories found. Add categories first.</p>}
            </div>
          </div>
        )}

        {/* Section 4 — AI Personality */}
        {activeSection === 'personality' && (
          <div className="space-y-5" data-testid="section-personality">
            <h3 className="font-bold text-lg">AI Personality Controls</h3>

            <div className="bg-white rounded-xl border p-4 space-y-3">
              <Label className="text-sm font-bold">Tone: Formal ↔ Casual</Label>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-14">Formal</span>
                <input
                  type="range" min="0" max="100" step="5"
                  value={settings.personality.tone}
                  onChange={e => updateNested('personality.tone', Number(e.target.value))}
                  className="flex-1 accent-[#ee922c]"
                  data-testid="personality-tone"
                />
                <span className="text-xs text-gray-500 w-14 text-right">Casual</span>
                <span className="text-xs font-bold text-[#ee922c] w-8">{settings.personality.tone}%</span>
              </div>
            </div>

            <div className="bg-white rounded-xl border p-4 space-y-3">
              <Label className="text-sm font-bold">Response Length</Label>
              <div className="flex gap-2">
                {['short', 'medium', 'detailed'].map(opt => (
                  <button
                    key={opt}
                    onClick={() => updateNested('personality.length', opt)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                      settings.personality.length === opt
                        ? 'bg-[#ee922c]/10 border-[#ee922c] text-[#ee922c]'
                        : 'bg-white border-gray-200 text-gray-600'
                    }`}
                    data-testid={`length-${opt}`}
                  >
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border p-4 space-y-3">
              <Label className="text-sm font-bold">Aggressiveness</Label>
              <div className="flex gap-2">
                {[
                  { value: 'soft', label: 'Soft Sell' },
                  { value: 'balanced', label: 'Balanced' },
                  { value: 'high_urgency', label: 'High Urgency' }
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => updateNested('personality.aggressiveness', opt.value)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                      settings.personality.aggressiveness === opt.value
                        ? 'bg-[#ee922c]/10 border-[#ee922c] text-[#ee922c]'
                        : 'bg-white border-gray-200 text-gray-600'
                    }`}
                    data-testid={`aggr-${opt.value}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="bg-white rounded-xl border p-4 flex items-center gap-3 cursor-pointer" data-testid="emoji-toggle">
                <input
                  type="checkbox"
                  checked={settings.personality.emoji_usage}
                  onChange={e => updateNested('personality.emoji_usage', e.target.checked)}
                  className="rounded"
                />
                <div>
                  <span className="text-sm font-bold">Emoji Usage</span>
                  <p className="text-xs text-gray-500">Allow emojis in chatbot replies</p>
                </div>
              </label>

              <div className="bg-white rounded-xl border p-4 space-y-2">
                <Label className="text-sm font-bold">Promotional Intensity</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Low</span>
                  <input
                    type="range" min="0" max="100" step="5"
                    value={settings.personality.promo_intensity}
                    onChange={e => updateNested('personality.promo_intensity', Number(e.target.value))}
                    className="flex-1 accent-[#ee922c]"
                    data-testid="promo-intensity"
                  />
                  <span className="text-xs text-gray-500">High</span>
                  <span className="text-xs font-bold text-[#ee922c]">{settings.personality.promo_intensity}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section 5 — Engagement Hooks */}
        {activeSection === 'engagement' && (
          <div className="space-y-4" data-testid="section-engagement">
            <h3 className="font-bold text-lg">User Engagement & Retention Hooks</h3>
            {[
              { key: 're_engagement_message', label: 'Re-engagement Message', desc: 'Shown when user returns after leaving' },
              { key: 'exit_intent_message', label: 'Exit Intent Message', desc: 'Triggered when user tries to leave' },
              { key: 'inactivity_message', label: 'Inactivity Follow-up', desc: 'Sent after idle period' },
              { key: 'deal_alert_message', label: 'Deal Alert Prompt', desc: 'Push prompt for new deals' }
            ].map(item => (
              <div key={item.key} className="bg-white rounded-xl border p-4 space-y-2">
                <Label className="text-sm font-bold">{item.label}</Label>
                <p className="text-xs text-gray-400">{item.desc}</p>
                <Textarea
                  value={settings.engagement[item.key] || ''}
                  onChange={e => updateNested(`engagement.${item.key}`, e.target.value)}
                  className="min-h-[50px] text-sm"
                  data-testid={`engagement-${item.key}`}
                />
              </div>
            ))}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border p-4 space-y-2">
                <Label className="text-sm font-bold">Inactivity Timer (seconds)</Label>
                <Input
                  type="number" min="5" max="300"
                  value={settings.engagement.inactivity_seconds}
                  onChange={e => updateNested('engagement.inactivity_seconds', Number(e.target.value))}
                  data-testid="inactivity-timer"
                />
              </div>
              <label className="bg-white rounded-xl border p-4 flex items-center gap-3 cursor-pointer" data-testid="greeting-toggle">
                <input
                  type="checkbox"
                  checked={settings.engagement.personalized_greeting}
                  onChange={e => updateNested('engagement.personalized_greeting', e.target.checked)}
                  className="rounded"
                />
                <div>
                  <span className="text-sm font-bold">Personalized Greeting</span>
                  <p className="text-xs text-gray-500">Use user's name if logged in</p>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Section 6 — Prime Membership */}
        {activeSection === 'prime' && (
          <div className="space-y-4" data-testid="section-prime">
            <h3 className="font-bold text-lg">Prime Membership Deal Logic</h3>
            <p className="text-sm text-gray-500">Schema-ready membership tier system. Enable to differentiate exclusive deals.</p>

            <label className="bg-white rounded-xl border p-4 flex items-center gap-3 cursor-pointer" data-testid="prime-toggle">
              <input
                type="checkbox"
                checked={settings.prime_membership.enabled}
                onChange={e => updateNested('prime_membership.enabled', e.target.checked)}
                className="rounded w-5 h-5"
              />
              <div>
                <span className="text-sm font-bold">Enable Prime/Exclusive Deal Mode</span>
                <p className="text-xs text-gray-500">Activates exclusive tier logic for chatbot and deal display</p>
              </div>
            </label>

            {settings.prime_membership.enabled && (
              <>
                <div className="bg-white rounded-xl border p-4 space-y-3">
                  <Label className="text-sm font-bold">Tier Label</Label>
                  <Input
                    value={settings.prime_membership.tier_label}
                    onChange={e => updateNested('prime_membership.tier_label', e.target.value)}
                    placeholder="e.g. Prime Member Deal, Hot Deal, Members Only"
                    data-testid="prime-tier-label"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border p-4 space-y-2">
                    <Label className="text-sm font-bold">Non-Member Teaser</Label>
                    <Textarea
                      value={settings.prime_membership.non_member_teaser}
                      onChange={e => updateNested('prime_membership.non_member_teaser', e.target.value)}
                      className="min-h-[60px] text-sm"
                      data-testid="prime-non-member"
                    />
                  </div>
                  <div className="bg-white rounded-xl border p-4 space-y-2">
                    <Label className="text-sm font-bold">Member Unlock Message</Label>
                    <Textarea
                      value={settings.prime_membership.member_unlock}
                      onChange={e => updateNested('prime_membership.member_unlock', e.target.value)}
                      className="min-h-[60px] text-sm"
                      data-testid="prime-member-msg"
                    />
                  </div>
                </div>

                <div className="bg-white rounded-xl border p-4 space-y-3">
                  <Label className="text-sm font-bold">Exclusive Deal Badge</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs text-gray-500">Badge Text</Label>
                      <Input
                        value={settings.prime_membership.badge_label}
                        onChange={e => updateNested('prime_membership.badge_label', e.target.value)}
                        placeholder="PRIME"
                        data-testid="prime-badge-label"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Badge Color</Label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          value={settings.prime_membership.badge_color}
                          onChange={e => updateNested('prime_membership.badge_color', e.target.value)}
                          className="w-10 h-10 rounded-lg border cursor-pointer"
                        />
                        <Input
                          value={settings.prime_membership.badge_color}
                          onChange={e => updateNested('prime_membership.badge_color', e.target.value)}
                          className="flex-1 font-mono text-xs"
                          data-testid="prime-badge-color"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Icon</Label>
                      <select
                        value={settings.prime_membership.badge_icon}
                        onChange={e => updateNested('prime_membership.badge_icon', e.target.value)}
                        className="w-full border rounded-lg px-2 py-2 text-sm bg-white"
                      >
                        <option value="crown">Crown</option>
                        <option value="star">Star</option>
                        <option value="diamond">Diamond</option>
                        <option value="fire">Fire</option>
                      </select>
                    </div>
                  </div>
                  {/* Badge preview */}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-500">Preview:</span>
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: settings.prime_membership.badge_color }}
                    >
                      <Crown className="w-3 h-3" />
                      {settings.prime_membership.badge_label}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Section 7 — Smart Notifications */}
        {activeSection === 'notifications' && (
          <div className="space-y-4" data-testid="section-notifications">
            <h3 className="font-bold text-lg">Smart Notifications Config</h3>

            <div className="bg-white rounded-xl border p-4 space-y-2">
              <Label className="text-sm font-bold">Deal Alert Frequency</Label>
              <div className="flex gap-2">
                {['realtime', 'hourly', 'daily', 'weekly'].map(opt => (
                  <button
                    key={opt}
                    onClick={() => updateNested('notifications.alert_frequency', opt)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      settings.notifications.alert_frequency === opt
                        ? 'bg-[#ee922c]/10 border-[#ee922c] text-[#ee922c]'
                        : 'bg-white border-gray-200 text-gray-600'
                    }`}
                    data-testid={`freq-${opt}`}
                  >
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <label className="bg-white rounded-xl border p-4 flex items-center gap-3 cursor-pointer" data-testid="wishlist-toggle">
              <input
                type="checkbox"
                checked={settings.notifications.wishlist_suggestions}
                onChange={e => updateNested('notifications.wishlist_suggestions', e.target.checked)}
                className="rounded"
              />
              <div>
                <span className="text-sm font-bold">Wishlist-based Suggestions</span>
                <p className="text-xs text-gray-500">Suggest related deals based on user's wishlist items</p>
              </div>
            </label>

            <div className="bg-white rounded-xl border p-4 space-y-2">
              <Label className="text-sm font-bold">Price Drop Alert Message</Label>
              <Textarea
                value={settings.notifications.price_drop_message}
                onChange={e => updateNested('notifications.price_drop_message', e.target.value)}
                className="min-h-[50px] text-sm"
                data-testid="price-drop-msg"
              />
            </div>

            <div className="bg-white rounded-xl border p-4 space-y-2">
              <Label className="text-sm font-bold">Limited Stock Urgency Message</Label>
              <Textarea
                value={settings.notifications.limited_stock_message}
                onChange={e => updateNested('notifications.limited_stock_message', e.target.value)}
                className="min-h-[50px] text-sm"
                data-testid="limited-stock-msg"
              />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
