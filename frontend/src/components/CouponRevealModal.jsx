import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, ExternalLink, Clock, Sparkles } from 'lucide-react';
import { trackClick } from '../lib/api';
import { toast } from 'sonner';
import { ShareButtonsFull } from './ShareButtons';
import { trackCouponReveal, trackCouponCopy, trackAffiliateClick } from '../lib/analytics';

export default function CouponRevealModal({ deal, isOpen, onClose }) {
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [redirecting, setRedirecting] = useState(false);

  const hasCode = deal?.code && deal.code.trim() !== '';

  // --- IMPROVED REDIRECT LOGIC ---
  const handleRedirect = useCallback(async () => {
    if (!deal || !deal.affiliate_url) return;
    
    // Ensure URL is absolute for mobile safety
    let finalUrl = deal.affiliate_url.trim();
    if (!finalUrl.startsWith('http')) {
      finalUrl = `https://${finalUrl}`;
    }

    // Track events
    trackAffiliateClick(deal.id || deal._id, deal.brand_name, finalUrl);
    
    try {
      // Fire and forget tracking so it doesn't slow down the user
      trackClick(deal.id || deal._id, 'web').catch(() => {});
    } catch (error) {
      console.error('Tracking failed');
    }
    
    // Open the store
    const newWindow = window.open(finalUrl, '_blank', 'noopener,noreferrer');
    
    // FALLBACK: If mobile browser blocks the popup, use the current tab
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      window.location.href = finalUrl;
    }
  }, [deal]);

  // Handle Automatic Redirect for Codes
  useEffect(() => {
    if (!isOpen || !hasCode) return;

    trackCouponReveal(deal.id, deal.brand_name, deal.discount_value || 0);

    setCountdown(3);
    setRedirecting(true);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Only auto-redirect if the user is still on the modal
          if (redirecting) handleRedirect();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, hasCode, deal, handleRedirect]);

  // Handle Deals WITHOUT Codes (Instant Redirect)
  useEffect(() => {
    if (isOpen && !hasCode) {
      handleRedirect();
      onClose();
    }
  }, [isOpen, hasCode, handleRedirect, onClose]);

  const copyToClipboard = async () => {
    if (!deal?.code) return;
    trackCouponCopy(deal.id, deal.brand_name, deal.code);
    
    try {
      await navigator.clipboard.writeText(deal.code);
      setCopied(true);
      toast.success('Code copied!');
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = deal.code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      toast.success('Code copied!');
    }
  };

  const handleClose = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setRedirecting(false);
    setCopied(false);
    setCountdown(3);
    onClose();
  };

  if (!deal || !hasCode) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          <motion.div
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
          >
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 transition-colors z-10"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="bg-gradient-to-r from-[#ee922c] to-[#d9811f] p-6 text-white">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Exclusive Code</span>
              </div>
              <h2 className="font-display font-bold text-2xl">{deal.brand_name}</h2>
              <p className="text-white/90 text-sm mt-1 line-clamp-1">{deal.title}</p>
            </div>

            <div className="p-6">
              <div className="border-2 border-dashed border-orange-200 rounded-2xl p-6 mb-6 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-[0.2em] font-bold mb-3">Click to copy code</p>
                <div 
                  onClick={copyToClipboard}
                  className="cursor-pointer group relative flex items-center justify-center gap-4 bg-orange-50 py-3 px-4 rounded-xl hover:bg-orange-100 transition-colors"
                >
                  <code className="font-display font-black text-3xl text-[#ee922c] tracking-wider">
                    {deal.code}
                  </code>
                  <div className={`p-2 rounded-lg ${copied ? 'bg-green-500 text-white' : 'text-orange-400'}`}>
                    {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </div>
                </div>
              </div>

              {redirecting && countdown > 0 && (
                <div className="flex items-center justify-center gap-2 text-gray-500 mb-6 bg-gray-50 py-2 rounded-full">
                  <Clock className="w-4 h-4 animate-spin" />
                  <span className="text-xs">Redirecting to store in <strong>{countdown}s</strong></span>
                </div>
              )}

              <button
                onClick={handleRedirect}
                className="w-full bg-[#3c7b48] hover:bg-[#2d6339] text-white font-bold rounded-xl px-6 py-4 flex items-center justify-center gap-2 shadow-lg shadow-green-900/10 active:scale-[0.98] transition-all"
              >
                <ExternalLink className="w-5 h-5" />
                <span>Go to {deal.brand_name} Store</span>
              </button>

              <div className="mt-6 pt-4 border-t border-gray-100">
                <p className="text-center text-[11px] text-gray-400 font-medium mb-3 uppercase tracking-wider">Share this deal</p>
                <ShareButtonsFull deal={deal} />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
