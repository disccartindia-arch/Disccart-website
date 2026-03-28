import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Zap, ArrowRight, Tag } from 'lucide-react';
import { motion } from 'framer-motion';
import { getCoupons, getCategories } from '../lib/api';
import DealCard from '../components/DealCard';
import CategoryPills from '../components/CategoryPills';

export default function HomePage() {
  const [featuredDeals, setFeaturedDeals] = useState([]);
  const [trendingDeals, setTrendingDeals] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [featured, all, cats] = await Promise.all([
          getCoupons({ featured: true, limit: 4 }),
          getCoupons({ limit: 12 }),
          getCategories()
        ]);
        setFeaturedDeals(featured);
        setTrendingDeals(all);
        setCategories(cats);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const categoryImages = {
    'Electronics': 'https://images.unsplash.com/photo-1595284842888-519573d8fb7b?w=400',
    'Fashion': 'https://images.pexels.com/photos/7679655/pexels-photo-7679655.jpeg?w=400',
    'Food & Dining': 'https://images.pexels.com/photos/4440858/pexels-photo-4440858.jpeg?w=400',
    'Travel': 'https://images.pexels.com/photos/8216324/pexels-photo-8216324.jpeg?w=400',
    'Beauty': 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400',
    'Home & Living': 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400'
  };

  return (
    <div className="pb-20 md:pb-8" data-testid="home-page">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-orange-50 to-green-50 py-8 md:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="font-display font-black text-4xl sm:text-5xl lg:text-6xl tracking-tighter text-gray-900 mb-4">
              Best Deals, <span className="gradient-text">Smart Savings</span>
            </h1>
            <p className="text-lg text-gray-600 mb-8">
              Discover verified coupons and exclusive deals from top brands. Save big on every purchase!
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/trending" className="bg-[#FF8C00] hover:bg-[#E67E00] text-white font-bold rounded-xl px-6 py-3 flex items-center gap-2 transition-all shadow-lg shadow-orange-500/25" data-testid="explore-deals-btn">
                <Zap className="w-5 h-5" />
                Explore Deals
              </Link>
              <Link to="/categories" className="border-2 border-gray-200 hover:border-[#FF8C00] text-gray-900 font-bold rounded-xl px-6 py-3 flex items-center gap-2 transition-colors" data-testid="view-categories-btn">
                <Tag className="w-5 h-5" />
                View Categories
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Category Pills */}
      <section className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <CategoryPills />
        </div>
      </section>

      {/* Featured Deals */}
      {featuredDeals.length > 0 && (
        <section className="py-6" data-testid="featured-section">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Zap className="w-6 h-6 text-[#FF8C00]" />
                <h2 className="font-display font-bold text-2xl text-gray-900">Featured Deals</h2>
              </div>
              <Link to="/trending" className="text-[#FF8C00] font-medium flex items-center gap-1 hover:gap-2 transition-all">
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {loading
                ? [...Array(4)].map((_, i) => (
                    <div key={i} className="bg-gray-200 rounded-2xl h-80 animate-pulse" />
                  ))
                : featuredDeals.map((deal) => (
                    <DealCard key={deal.id} deal={deal} />
                  ))
              }
            </div>
          </div>
        </section>
      )}

      {/* Category Cards */}
      <section className="py-8" data-testid="categories-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 mb-6">
            <Tag className="w-6 h-6 text-[#228B22]" />
            <h2 className="font-display font-bold text-2xl text-gray-900">Shop by Category</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {categories.map((category) => (
              <Link
                key={category.id}
                to={`/category/${category.slug}`}
                className="relative aspect-square rounded-2xl overflow-hidden group"
                data-testid={`category-card-${category.slug}`}
              >
                <img
                  src={categoryImages[category.name] || category.image_url}
                  alt={category.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                  <h3 className="font-display font-bold text-lg">{category.name}</h3>
                  <p className="text-sm text-white/80">{category.deal_count || 0} deals</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Trending Deals */}
      <section className="py-8" data-testid="trending-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-[#228B22]" />
              <h2 className="font-display font-bold text-2xl text-gray-900">Trending Now</h2>
            </div>
            <Link to="/trending" className="text-[#FF8C00] font-medium flex items-center gap-1 hover:gap-2 transition-all">
              See All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {loading
              ? [...Array(8)].map((_, i) => (
                  <div key={i} className="bg-gray-200 rounded-2xl h-80 animate-pulse" />
                ))
              : trendingDeals.map((deal) => (
                  <DealCard key={deal.id} deal={deal} />
                ))
            }
          </div>
        </div>
      </section>

      {/* SEO Quick Links */}
      <section className="py-8 bg-gray-50" data-testid="seo-links-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display font-bold text-xl text-gray-900 mb-4">Popular Searches</h2>
          <div className="flex flex-wrap gap-2">
            {[
              'amazon-coupons',
              'myntra-sale-today',
              'flipkart-offers',
              'swiggy-coupons',
              'electronics-deals',
              'fashion-sale',
              'best-deals-under-1000'
            ].map((slug) => (
              <Link
                key={slug}
                to={`/deals/${slug}`}
                className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-600 hover:border-[#FF8C00] hover:text-[#FF8C00] transition-colors"
              >
                {slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
