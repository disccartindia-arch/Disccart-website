import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Zap, ArrowRight, Tag, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { getCoupons, getCategories, getHeroConfig } from '../lib/api';
import DealCard from '../components/DealCard';
import CategoryPills from '../components/CategoryPills';
import FilterDrawer from '../components/FilterDrawer';
import HeroSlider from '../components/HeroSlider';
import { HomeSEO } from '../components/SEO';

export default function HomePage() {
  const [featuredDeals, setFeaturedDeals] = useState([]);
  const [trendingDeals, setTrendingDeals] = useState([]);
  const [limitedDeals, setLimitedDeals] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hero, setHero] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [featured, all, cats, limited, heroData] = await Promise.all([
          getCoupons({ featured: true, limit: 4 }),
          getCoupons({ limit: 12 }),
          getCategories(),
          getCoupons({ offer_type: 'limited', limit: 6 }),
          getHeroConfig().catch(() => null)
        ]);
        setFeaturedDeals(Array.isArray(featured) ? featured : []);
        setTrendingDeals(Array.isArray(all) ? all : []);
        setCategories(Array.isArray(cats) ? cats : []);
        const limitedResults = Array.isArray(limited) ? limited.filter(d => (d.offer_type || '').includes('limited')) : [];
        setLimitedDeals(limitedResults);
        if (heroData) setHero(heroData);
      } catch (error) {
        console.error('Failed to fetch data:', error);
        setFeaturedDeals([]);
        setTrendingDeals([]);
        setCategories([]);
        setLimitedDeals([]);
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
      <HomeSEO />
      {/* Hero Section */}
      <section className="relative overflow-hidden py-8 md:py-12" style={{ background: hero?.bg_gradient || 'linear-gradient(135deg, #FFF8F0 0%, #F0F9F0 40%, #E8F5E9 65%, #FFF3E0 100%)' }}>
        {/* Floating decorative elements */}
        {(hero?.show_floating_icons !== false) && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-10 -left-10 w-60 h-60 rounded-full bg-green-200/20 blur-3xl hero-float-slow" />
          <div className="absolute top-20 right-10 w-40 h-40 rounded-full bg-orange-200/15 blur-2xl hero-float-medium" />
          <div className="absolute bottom-0 left-1/3 w-52 h-52 rounded-full bg-green-100/20 blur-3xl hero-float-reverse" />
          <div className="absolute -bottom-8 right-1/4 w-36 h-36 rounded-full bg-amber-100/15 blur-2xl hero-float-slow" />
          <svg className="absolute top-[15%] left-[8%] w-8 h-8 text-green-400/[0.08] hero-float-medium" fill="currentColor" viewBox="0 0 24 24"><path d="M21.41 11.58l-9-9A2 2 0 0011 2H4a2 2 0 00-2 2v7c0 .55.22 1.05.59 1.42l9 9a2 2 0 002.82 0l7-7a2 2 0 000-2.84zM7 9a2 2 0 110-4 2 2 0 010 4z"/></svg>
          <svg className="absolute top-[25%] right-[12%] w-10 h-10 text-orange-400/[0.07] hero-float-slow" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><text x="12" y="16" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">%</text></svg>
          <svg className="absolute bottom-[20%] left-[15%] w-7 h-7 text-green-500/[0.06] hero-float-reverse" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-6h2v2h-2zm0-8h2v6h-2z"/></svg>
          <svg className="absolute top-[60%] right-[20%] w-6 h-6 text-amber-400/[0.06] hero-float-medium" fill="currentColor" viewBox="0 0 24 24"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1 1 0 0020.01 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>
          <svg className="absolute top-[40%] left-[75%] w-9 h-9 text-green-300/[0.05] hero-float-slow" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99z"/></svg>
          <svg className="absolute bottom-[35%] left-[45%] w-6 h-6 text-orange-300/[0.06] hero-float-reverse" fill="currentColor" viewBox="0 0 24 24"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>
          {(hero?.show_wave !== false) && (
          <svg className="absolute bottom-0 left-0 w-full h-16 text-green-100/30" viewBox="0 0 1440 60" fill="currentColor" preserveAspectRatio="none">
            <path d="M0,30 C360,60 720,0 1080,30 C1260,45 1380,15 1440,30 L1440,60 L0,60 Z" />
          </svg>
          )}
        </div>
        )}

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="font-display font-black text-4xl sm:text-5xl lg:text-6xl tracking-tighter mb-4" style={{ color: hero?.heading_color || '#111827' }}>
              {hero?.heading_line1 || 'Best Deals,'} <span className="gradient-text" style={hero?.accent_color ? { backgroundImage: `linear-gradient(135deg, ${hero.accent_color}, #3c7b48)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } : {}}>{hero?.heading_line2 || 'Smart Savings'}</span>
            </h1>
            <p className="text-lg mb-8" style={{ color: hero?.subtext_color || '#4B5563' }}>
              {hero?.subtext || 'Discover verified coupons and exclusive deals from top brands. Save big on every purchase!'}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to={hero?.btn1_link || '/trending'} className="hover:opacity-90 text-white font-bold rounded-xl px-6 py-3 flex items-center gap-2 transition-all shadow-lg" style={{ backgroundColor: hero?.accent_color || '#ee922c', boxShadow: `0 10px 15px -3px ${hero?.accent_color || '#ee922c'}40` }} data-testid="explore-deals-btn">
                <Zap className="w-5 h-5" />
                {hero?.btn1_text || 'Explore Deals'}
              </Link>
              <Link to={hero?.btn2_link || '/categories'} className="border-2 border-gray-200 hover:border-[#ee922c] font-bold rounded-xl px-6 py-3 flex items-center gap-2 transition-colors" style={{ color: hero?.heading_color || '#111827' }} data-testid="view-categories-btn">
                <Tag className="w-5 h-5" />
                {hero?.btn2_text || 'View Categories'}
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Hero Slider */}
      <section className="py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <HeroSlider />
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
                <Zap className="w-6 h-6 text-[#ee922c]" />
                <h2 className="font-display font-bold text-2xl text-gray-900">Featured Deals</h2>
              </div>
              <Link to="/trending" className="text-[#ee922c] font-medium flex items-center gap-1 hover:gap-2 transition-all">
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
            <Tag className="w-6 h-6 text-[#3c7b48]" />
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
                  <p className="text-sm text-white/80">{category.coupon_count || 0} deals</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Limited Time Offers */}
      {limitedDeals.length > 0 && (
        <section className="py-8" data-testid="limited-offers-section">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="bg-red-500 text-white p-1.5 rounded-lg animate-pulse">
                  <Clock className="w-5 h-5" />
                </div>
                <h2 className="font-display font-bold text-2xl text-gray-900">Limited Time Offers</h2>
              </div>
              <Link to="/deals/limited-time" className="text-red-500 font-medium flex items-center gap-1 hover:gap-2 transition-all">
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {limitedDeals.slice(0, 6).map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Trending Deals */}
      <section className="py-8" data-testid="trending-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-[#3c7b48]" />
              <h2 className="font-display font-bold text-2xl text-gray-900">Trending Now</h2>
            </div>
            <Link to="/trending" className="text-[#ee922c] font-medium flex items-center gap-1 hover:gap-2 transition-all">
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
                className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-600 hover:border-[#ee922c] hover:text-[#ee922c] transition-colors"
              >
                {slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <FilterDrawer onApply={() => {}} />
    </div>
  );
}
