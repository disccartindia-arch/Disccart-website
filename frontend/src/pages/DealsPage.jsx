import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Zap, Tag, Timer } from 'lucide-react';
import { motion } from 'framer-motion';
import { getCoupons } from '../lib/api';
import DealCard from '../components/DealCard';
import SEO from '../components/SEO';

export default function DealsPage() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeals = async () => {
      try {
        const data = await getCoupons({ limit: 50 });
        setDeals(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to fetch deals:', error);
        setDeals([]);
      } finally {
        setLoading(false);
      }
    };
    fetchDeals();
  }, []);

  return (
    <div className="pb-20 md:pb-8" data-testid="deals-page">
      <SEO 
        title="All Deals - Best Coupons & Offers"
        description="Browse all active deals, coupons, and offers from top brands. Find verified discounts updated daily."
        keywords="all deals, coupons, offers, discounts, promo codes"
        url="/deals"
      />

      {/* Hero */}
      <section className="bg-gradient-to-br from-orange-50 to-green-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <h1 className="font-display font-black text-4xl md:text-5xl text-gray-900 mb-4">
              All Deals & Offers
            </h1>
            <p className="text-gray-600 text-lg">
              {deals.length}+ verified deals from top brands
            </p>
          </motion.div>
        </div>
      </section>

      {/* Quick Filters */}
      <section className="py-6 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-3 overflow-x-auto hide-scrollbar">
            <Link
              to="/deals"
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-[#ee922c] text-white rounded-full font-medium text-sm"
            >
              <Tag className="w-4 h-4" />
              All Deals
            </Link>
            <Link
              to="/deals/limited-time"
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-full font-medium text-sm hover:border-[#ee922c]"
            >
              <Clock className="w-4 h-4" />
              Limited Time
            </Link>
            <Link
              to="/trending"
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-full font-medium text-sm hover:border-[#ee922c]"
            >
              <Zap className="w-4 h-4" />
              Trending
            </Link>
          </div>
        </div>
      </section>

      {/* Deals Grid */}
      <section className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="bg-gray-200 rounded-2xl h-80 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {deals.map((deal, index) => (
                <motion.div
                  key={deal.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <DealCard deal={deal} />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
