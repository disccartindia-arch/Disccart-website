import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Laptop, Shirt, UtensilsCrossed, Plane, Sparkles, Home, Tag } from 'lucide-react';
import { getCategories } from '../lib/api';

const iconMap = {
  'Laptop': Laptop,
  'Shirt': Shirt,
  'UtensilsCrossed': UtensilsCrossed,
  'Plane': Plane,
  'Sparkles': Sparkles,
  'Home': Home
};

export default function CategoryPills({ activeCategory = null }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await getCategories();
        setCategories(data);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-4 hide-scrollbar" data-testid="category-pills-loading">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex-shrink-0 w-24 h-10 bg-gray-200 rounded-full animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 hide-scrollbar" data-testid="category-pills">
      {/* All Deals pill */}
      <Link
        to="/"
        className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm transition-all ${
          !activeCategory 
            ? 'bg-[#ee922c] text-white' 
            : 'bg-white border border-gray-200 text-gray-700 hover:border-[#ee922c]'
        }`}
        data-testid="category-all"
      >
        <Tag className="w-4 h-4" />
        <span>All Deals</span>
      </Link>

      {categories.map((category) => {
        const Icon = iconMap[category.icon] || Tag;
        const isActive = activeCategory === category.slug;
        
        return (
          <Link
            key={category.id}
            to={`/category/${category.slug}`}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm transition-all ${
              isActive 
                ? 'bg-[#ee922c] text-white' 
                : 'bg-white border border-gray-200 text-gray-700 hover:border-[#ee922c]'
            }`}
            data-testid={`category-${category.slug}`}
          >
            <Icon className="w-4 h-4" />
            <span>{category.name}</span>
            {category.deal_count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-gray-100'}`}>
                {category.deal_count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
