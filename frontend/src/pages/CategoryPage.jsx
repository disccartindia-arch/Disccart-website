import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios'; // Using axios directly for the critical filter fix
import DealCard from '../components/DealCard';
import CategoryPills from '../components/CategoryPills';
import { motion } from 'framer-motion';
import { CategoryPageSEO } from '../components/SEO';

export default function CategoryPage() {
  // slug matches the path in your App.jsx (e.g., /category/:slug)
  const { slug } = useParams(); 
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeals = async () => {
      setLoading(true);
      try {
        // CRITICAL FIX: We pass the slug as a query parameter called 'category'
        // This tells your server.py to filter only for this specific category
        const response = await axios.get(
          `https://disccart-api.onrender.com/api/coupons?category=${slug}`
        );
        
        // Ensure we handle cases where the API might return an object instead of array
        const data = Array.isArray(response.data) ? response.data : [];
        setDeals(data);
      } catch (error) {
        console.error('Failed to fetch filtered deals:', error);
        setDeals([]);
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchDeals();
    }
  }, [slug]); // Re-runs every time the URL slug changes

  // Formats 'food-dining' into 'Food Dining' for the title
  const categoryName = slug
    ? slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : 'Category';

  return (
    <div className="pb-20 md:pb-8" data-testid="category-page">
      <CategoryPageSEO category={slug} dealCount={deals.length} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Category Pills - Navigation */}
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
            {deals.length} {deals.length === 1 ? 'deal' : 'deals'} found in {categoryName}
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
              <DealCard key={deal.id || deal._id} deal={deal} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
            <p className="text-gray-500 text-lg">No deals found in {categoryName} yet.</p>
            <p className="text-gray-400 text-sm mt-1">Check back later for fresh offers!</p>
          </div>
        )}
      </div>
    </div>
  );
}
