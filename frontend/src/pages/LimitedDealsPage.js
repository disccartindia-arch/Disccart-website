import { useState, useEffect } from 'react';
import { Clock, Timer, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { getCoupons } from '../lib/api';
import DealCard from '../components/DealCard';
import SEO from '../components/SEO';

// Countdown Timer Component
function CountdownTimer({ expiresAt }) {
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  function calculateTimeLeft() {
    const difference = new Date(expiresAt) - new Date();
    if (difference <= 0) {
      return { hours: 0, minutes: 0, seconds: 0, expired: true };
    }
    return {
      hours: Math.floor(difference / (1000 * 60 * 60)),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
      expired: false
    };
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  if (timeLeft.expired) {
    return (
      <span className="text-red-500 font-medium flex items-center gap-1">
        <AlertTriangle className="w-4 h-4" /> Expired
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <Timer className="w-4 h-4 text-red-500 animate-pulse" />
      <div className="flex items-center gap-1">
        <span className="bg-gray-900 text-white px-2 py-1 rounded font-mono font-bold">
          {String(timeLeft.hours).padStart(2, '0')}
        </span>
        <span className="text-gray-500">:</span>
        <span className="bg-gray-900 text-white px-2 py-1 rounded font-mono font-bold">
          {String(timeLeft.minutes).padStart(2, '0')}
        </span>
        <span className="text-gray-500">:</span>
        <span className="bg-gray-900 text-white px-2 py-1 rounded font-mono font-bold">
          {String(timeLeft.seconds).padStart(2, '0')}
        </span>
      </div>
    </div>
  );
}

export default function LimitedDealsPage() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeals = async () => {
      try {
        // Get featured deals (representing limited time offers)
        const data = await getCoupons({ featured: true, limit: 20 });
        // Add fake expiry times for demo (in production, this would come from backend)
        const dealsWithExpiry = data.map((deal, index) => ({
          ...deal,
          expires_at: new Date(Date.now() + (index + 1) * 3600000 * (Math.random() * 5 + 1)).toISOString()
        }));
        setDeals(dealsWithExpiry);
      } catch (error) {
        console.error('Failed to fetch deals:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDeals();
  }, []);

  return (
    <div className="pb-20 md:pb-8" data-testid="limited-deals-page">
      <SEO 
        title="Limited Time Deals - Expiring Soon!"
        description="Don't miss out! These exclusive deals are expiring soon. Grab them before they're gone."
        keywords="limited time deals, expiring offers, flash sale, urgent discounts"
        url="/deals/limited-time"
      />

      {/* Hero */}
      <section className="bg-gradient-to-br from-red-50 to-orange-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-full mb-4 animate-pulse">
              <Clock className="w-5 h-5" />
              <span className="font-bold">LIMITED TIME ONLY</span>
            </div>
            <h1 className="font-display font-black text-4xl md:text-5xl text-gray-900 mb-4">
              Deals Expiring Soon!
            </h1>
            <p className="text-gray-600 text-lg">
              Hurry! These exclusive offers won't last long
            </p>
          </motion.div>
        </div>
      </section>

      {/* Deals Grid */}
      <section className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-gray-200 rounded-2xl h-96 animate-pulse" />
              ))}
            </div>
          ) : deals.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {deals.map((deal, index) => (
                <motion.div
                  key={deal.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="relative"
                >
                  {/* Countdown Banner */}
                  <div className="absolute -top-3 left-4 right-4 z-10">
                    <div className="bg-white shadow-lg rounded-full px-4 py-2 flex items-center justify-center">
                      <CountdownTimer expiresAt={deal.expires_at} />
                    </div>
                  </div>
                  <div className="pt-4">
                    <DealCard deal={deal} />
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No limited time deals right now</p>
              <p className="text-gray-400 mt-2">Check back soon for flash sales!</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
