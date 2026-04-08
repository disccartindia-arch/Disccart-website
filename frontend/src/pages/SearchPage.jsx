import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { getCoupons } from '../lib/api';
import DealCard from '../components/DealCard';
import { motion } from 'framer-motion';
import { SearchSEO } from '../components/SEO';

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeals = async () => {
      setLoading(true);
      try {
        const data = await getCoupons({ search: query });
        setDeals(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to fetch deals:', error);
        setDeals([]);
      } finally {
        setLoading(false);
      }
    };
    if (query) {
      fetchDeals();
    }
  }, [query]);

  return (
    <div className="pb-20 md:pb-8" data-testid="search-page">
      <SearchSEO query={query} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-2 mb-2">
            <Search className="w-8 h-8 text-[#ee922c]" />
            <h1 className="font-display font-bold text-3xl text-gray-900">
              Search Results
            </h1>
          </div>
          <p className="text-gray-500">
            {deals.length} results for "{query}"
          </p>
        </motion.div>

        {/* Results Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-gray-200 rounded-2xl h-80 animate-pulse" />
            ))}
          </div>
        ) : deals.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {deals.map((deal) => (
              <DealCard key={deal.id} deal={deal} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No deals found for "{query}"</p>
            <p className="text-gray-400 mt-2">Try searching for a different term</p>
          </div>
        )}
      </div>
    </div>
  );
}
