import { useState } from 'react';
import { ExternalLink, Copy, Clock, Tag } from 'lucide-react';
import CouponRevealModal from './CouponRevealModal';
import DealDetailModal from './DealDetailModal';
import { resolveImageUrl } from '../lib/api';

export default function CompactDealCard({ deal }) {
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const dealId = deal.id || deal._id;
  const hasCode = deal.code && deal.code.trim() !== '';

  const sanitizedDeal = {
    ...deal,
    id: dealId,
    affiliate_url: deal.affiliate_url?.startsWith('http')
      ? deal.affiliate_url
      : `https://${deal.affiliate_url}`
  };

  const getDiscountText = () => {
    if (deal.discount_type === 'percentage' && deal.discount_value) return `${deal.discount_value}%`;
    if (deal.discount_type === 'flat' && deal.discount_value) return `₹${deal.discount_value}`;
    if (deal.discount_value) return `${deal.discount_value}%`;
    return null;
  };

  const discountText = getDiscountText();

  return (
    <>
      <div
        className="compact-deal-card bg-white rounded-xl border border-gray-100 p-2.5 flex items-stretch gap-2.5 cursor-pointer active:bg-gray-50 transition-colors relative overflow-hidden"
        onClick={() => setShowDetail(true)}
        data-testid={`compact-deal-${dealId}`}
      >
        {/* Thumbnail */}
        <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
          {deal.image_url ? (
            <img
              src={resolveImageUrl(deal.image_url)}
              alt={deal.title}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentElement.classList.add('flex', 'items-center', 'justify-center');
                const icon = document.createElement('div');
                icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ee922c" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>';
                e.target.parentElement.appendChild(icon);
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-50 to-green-50">
              <Tag className="w-5 h-5 text-[#ee922c]" />
            </div>
          )}
          {/* Discount badge overlay */}
          {discountText && (
            <div className="absolute top-0.5 left-0.5 bg-[#3c7b48] text-white text-[10px] font-black px-1.5 py-0.5 rounded-md leading-tight">
              {discountText} OFF
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          {/* Top: brand + title */}
          <div>
            {deal.brand_name && (
              <span className="text-[10px] font-bold text-[#ee922c] uppercase tracking-wide leading-none">
                {deal.brand_name}
              </span>
            )}
            <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight mt-0.5">
              {deal.title}
            </h3>
          </div>

          {/* Bottom: price row */}
          <div className="flex items-center gap-2 mt-1">
            {deal.discounted_price != null && deal.discounted_price > 0 && (
              <span className="text-sm font-black text-[#3c7b48]">
                ₹{Number(deal.discounted_price).toLocaleString()}
              </span>
            )}
            {deal.original_price != null && deal.original_price > 0 && deal.original_price !== deal.discounted_price && (
              <span className="text-xs text-gray-400 line-through">
                ₹{Number(deal.original_price).toLocaleString()}
              </span>
            )}
            {deal.expires_at && (
              <span className="text-[10px] text-red-500 flex items-center gap-0.5 ml-auto">
                <Clock className="w-2.5 h-2.5" />
                Limited
              </span>
            )}
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowModal(true);
          }}
          className="flex-shrink-0 self-center bg-[#ee922c] hover:bg-[#d9811f] text-white rounded-lg px-3 py-2.5 flex items-center gap-1 text-xs font-bold min-w-[60px] justify-center active:scale-95 transition-transform"
          style={{ minHeight: '44px' }}
          data-testid={`compact-cta-${dealId}`}
        >
          {hasCode ? (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Code</span>
            </>
          ) : (
            <>
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Deal</span>
            </>
          )}
        </button>
      </div>

      {/* Modals — preserve full detail + affiliate tracking */}
      <CouponRevealModal
        deal={sanitizedDeal}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
      <DealDetailModal
        deal={sanitizedDeal}
        isOpen={showDetail}
        onClose={() => setShowDetail(false)}
      />
    </>
  );
}
