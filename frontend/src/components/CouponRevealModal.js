import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Check, ExternalLink, Clock, Sparkles } from 'lucide-react';
import { trackClick } from '../lib/api';
import { toast } from 'sonner';

export default function CouponRevealModal({ deal, isOpen, onClose }) {
  const [copied, setCopied] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [redirecting, setRedirecting] = useState(false);

  const hasCode = deal?.code && deal.code.trim() !== '';

  const handleRedirect = useCallback(async () => {
    if (!deal) return;
    
    try {
      await trackClick(deal.id, 'web');
    } catch (error) {
      console.error('Failed to track click:', error);
    }
    
    window.open(deal.affiliate_url, '_blank', 'noopener,noreferrer');
  }, [deal]);

  useEffect(() => {
    if (!isOpen || !hasCode) return;

    // Start countdown for redirect
    setCountdown(3);
    setRedirecting(true);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleRedirect();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, hasCode, handleRedirect]);

  useEffect(() => {
    if (isOpen && !hasCode) {
      // For deals without code, redirect immediately
      handleRedirect();
      onClose();
    }
  }, [isOpen, hasCode, handleRedirect, onClose]);

  const copyToClipboard = async () => {
    if (!deal?.code) return;
    
    try {
      await navigator.clipboard.writeText(deal.code);
      setCopied(true);
      toast.success('Code copied to clipboard!');
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = deal.code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      toast.success('Code copied to clipboard!');
      setTimeout(() => setCopied(false), 3000);
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
          data-testid="coupon-modal"
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Close Button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 transition-colors z-10"
              data-testid="modal-close-btn"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Header */}
            <div className="bg-gradient-to-r from-[#FF8C00] to-[#E67E00] p-6 text-white">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5" />
                <span className="text-sm font-medium opacity-90">Exclusive Code</span>
              </div>
              <h2 className="font-display font-bold text-2xl">{deal.brand_name}</h2>
              <p className="text-white/80 text-sm mt-1">{deal.title}</p>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Coupon Code Box */}
              <div className="coupon-border rounded-2xl p-6 mb-6 relative">
                <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-2">Your Coupon Code</p>
                <div className="flex items-center justify-between gap-4">
                  <code className="font-display font-black text-3xl text-[#FF8C00] tracking-wider select-all">
                    {deal.code}
                  </code>
                  <button
                    onClick={copyToClipboard}
                    className={`p-3 rounded-xl transition-all ${
                      copied 
                        ? 'bg-[#228B22] text-white' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    data-testid="copy-code-btn"
                  >
                    {copied ? <Check className="w-6 h-6" /> : <Copy className="w-6 h-6" />}
                  </button>
                </div>
              </div>

              {/* Social Proof */}
              <div className="text-center mb-6">
                <p className="text-sm text-gray-600">
                  🔥 <span className="font-bold text-[#228B22]">93%</span> people saved money using this
                </p>
              </div>

              {/* Countdown / Redirect */}
              {redirecting && countdown > 0 ? (
                <div className="text-center mb-4">
                  <div className="flex items-center justify-center gap-2 text-gray-600">
                    <Clock className="w-4 h-4 animate-pulse" />
                    <span className="text-sm">Redirecting in <span className="font-bold text-[#FF8C00]">{countdown}</span> seconds...</span>
                  </div>
                </div>
              ) : null}

              {/* CTA Button */}
              <button
                onClick={handleRedirect}
                className="w-full bg-[#228B22] hover:bg-[#1D771D] text-white font-bold rounded-xl px-6 py-4 flex items-center justify-center gap-2 transition-all"
                data-testid="go-to-store-btn"
              >
                <ExternalLink className="w-5 h-5" />
                <span>Go to {deal.brand_name}</span>
              </button>

              {/* Tips */}
              <div className="mt-4 p-3 bg-orange-50 rounded-xl">
                <p className="text-xs text-orange-700">
                  💡 <strong>Tip:</strong> Apply the code at checkout before payment to get your discount!
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
