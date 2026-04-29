import { useState, useEffect, useRef, useCallback } from 'react';
import { Package, Loader2 } from 'lucide-react';
import { getCoupons, getFilteredDeals } from '../lib/api';
import CompactDealCard from '../components/CompactDealCard';
import DealFinderBar from '../components/DealFinderBar';
import { CompactDealCardSkeleton } from '../components/Skeletons';
import SEO from '../components/SEO';

export default function DealsPage() {
  const [deals, setDeals] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({});
  const fetchVersion = useRef(0);
  const LIMIT = 30;

  const buildApiParams = useCallback((f, pageNum) => {
    const params = { limit: LIMIT, skip: (pageNum - 1) * LIMIT };
    if (f.search) params.search = f.search;
    if (f.category) params.category = f.category;
    if (f.minDiscount && f.minDiscount > 0) params.min_discount = f.minDiscount;
    if (f.minPrice) params.min_price = Number(f.minPrice);
    if (f.maxPrice) params.max_price = Number(f.maxPrice);
    if (f.sortBy && f.sortBy !== 'newest') params.sort_by = f.sortBy;
    return params;
  }, []);

  const hasActiveFilters = useCallback((f) => {
    return !!(f.search || f.category || (f.minDiscount && f.minDiscount > 0) || f.minPrice || f.maxPrice || (f.sortBy && f.sortBy !== 'newest'));
  }, []);

  const fetchDeals = useCallback(async (f, pageNum = 1, append = false) => {
    const version = ++fetchVersion.current;
    if (!append) {
      setLoading(true);
      setDeals([]);
    } else {
      setLoadingMore(true);
    }

    try {
      let result;
      if (hasActiveFilters(f)) {
        const params = buildApiParams(f, pageNum);
        result = await getFilteredDeals(params);
      } else {
        const data = await getCoupons({ limit: LIMIT, page: pageNum });
        result = { deals: data?.deals || [], total: data?.total || 0 };
      }

      if (version !== fetchVersion.current) return;

      const items = Array.isArray(result.deals) ? result.deals : [];
      if (append) {
        setDeals(prev => [...prev, ...items]);
      } else {
        setDeals(items);
      }
      const totalCount = result.total || items.length;
      setTotal(totalCount);
      setHasMore((pageNum * LIMIT) < totalCount);
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to fetch deals:', error);
      if (version === fetchVersion.current) {
        if (!append) setDeals([]);
        setHasMore(false);
      }
    } finally {
      if (version === fetchVersion.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [buildApiParams, hasActiveFilters]);

  // Initial load
  useEffect(() => {
    fetchDeals(filters, 1);
  }, []);

  const handleFiltersChange = useCallback((newFilters) => {
    setFilters(newFilters);
    fetchDeals(newFilters, 1);
  }, [fetchDeals]);

  const loadMore = () => {
    fetchDeals(filters, page + 1, true);
  };

  return (
    <div className="pb-20 md:pb-8" data-testid="deals-page">
      <SEO
        title="Deal Finder - Best Deals & Offers"
        description="Browse and filter deals from top brands. Find verified discounts updated daily."
        keywords="deals, coupons, offers, discounts, deal finder"
        url="/deals"
      />

      {/* Sticky Deal Finder Bar */}
      <DealFinderBar
        onFiltersChange={handleFiltersChange}
        totalResults={total}
        loading={loading}
      />

      {/* Deal Feed — compact cards */}
      <section className="py-3" data-testid="deals-feed">
        <div className="max-w-4xl mx-auto px-2 sm:px-4 lg:px-8">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[...Array(8)].map((_, i) => (
                <CompactDealCardSkeleton key={i} />
              ))}
            </div>
          ) : deals.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2" data-testid="deals-list">
                {deals.map((deal) => (
                  <CompactDealCard key={deal.id} deal={deal} />
                ))}
              </div>

              {/* Load More */}
              {hasMore && (
                <div className="flex justify-center mt-4 mb-2" data-testid="load-more-container">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="px-6 py-2.5 bg-gray-900 text-white font-bold rounded-xl text-sm hover:bg-gray-800 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    data-testid="load-more-btn"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      'Load More Deals'
                    )}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-16" data-testid="no-deals-found">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-base font-semibold">No deals found</p>
              <p className="text-gray-400 mt-1 text-sm">Try adjusting your filters or check back later</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
