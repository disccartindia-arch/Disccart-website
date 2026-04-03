import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getCoupons } from '../lib/api';
import DealCard from '../components/DealCard';
import CategoryPills from '../components/CategoryPills';
import { motion } from 'framer-motion';
import { CategoryPageSEO } from '../components/SEO';

export default function CategoryPage() {
  const { slug } = useParams();
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeals = async () => {
      setLoading(true);
      try {
        const data = await getCoupons({ category: slug });
        setDeals(data);
      } catch (error) {
        console.error('Failed to fetch deals:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDeals();
  }, [slug]);

  const categoryName = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  return (
    <div className="pb-20 md:pb-8" data-testid="category-page">
      <CategoryPageSEO category={slug} dealCount={deals.length} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Category Pills */}
        <CategoryPills activeCategory={slug} />

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="font-display font-bold text-3xl text-gray-900 mb-2">
            {categoryName} Deals
          </h1>
          <p className="text-gray-500">
            {deals.length} deals found in {categoryName}
          </p>
        </motion.div>

        {/* Deals Grid */}
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
            <p className="text-gray-500 text-lg">No deals found in this category yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Inside CategoryPage.jsx
const { categorySlug } = useParams(); // Get category from URL (e.g., fashion)

useEffect(() => {
  const fetchDeals = async () => {
    try {
      // CRITICAL: We added '?category=' to the end of the URL
      const response = await axios.get(`https://disccart-api.onrender.com/api/coupons?category=${categorySlug}`);
      setDeals(response.data);
    } catch (error) {
      console.error("Error fetching filtered deals", error);
    }
  };
  fetchDeals();
}, [categorySlug]); // Re-run whenever the user clicks a different category

