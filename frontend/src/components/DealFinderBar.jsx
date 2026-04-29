import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Search, SlidersHorizontal, X, ChevronDown, RotateCcw } from 'lucide-react';
import { getCategories } from '../lib/api';

export default function DealFinderBar({ onFiltersChange, totalResults = 0, loading = false }) {
  const [expanded, setExpanded] = useState(false);
  const [categories, setCategories] = useState([]);
  const debounceRef = useRef(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [minDiscount, setMinDiscount] = useState(0);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  useEffect(() => {
    getCategories().then(cats => setCategories(cats || [])).catch(() => {});
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (selectedCategory) count++;
    if (minDiscount > 0) count++;
    if (minPrice) count++;
    if (maxPrice) count++;
    if (sortBy !== 'newest') count++;
    return count;
  }, [searchQuery, selectedCategory, minDiscount, minPrice, maxPrice, sortBy]);

  const emitFilters = useCallback((overrides = {}) => {
    const filters = {
      search: overrides.search ?? searchQuery,
      category: overrides.category ?? selectedCategory,
      minDiscount: overrides.minDiscount ?? minDiscount,
      minPrice: overrides.minPrice ?? minPrice,
      maxPrice: overrides.maxPrice ?? maxPrice,
      sortBy: overrides.sortBy ?? sortBy,
    };
    onFiltersChange?.(filters);
  }, [searchQuery, selectedCategory, minDiscount, minPrice, maxPrice, sortBy, onFiltersChange]);

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      emitFilters({ search: val });
    }, 300);
  };

  const handleCategoryChange = (val) => {
    setSelectedCategory(val);
    emitFilters({ category: val });
  };

  const handleDiscountChange = (val) => {
    const num = Number(val);
    setMinDiscount(num);
    emitFilters({ minDiscount: num });
  };

  const handleMinPriceChange = (val) => {
    setMinPrice(val);
    emitFilters({ minPrice: val });
  };

  const handleMaxPriceChange = (val) => {
    setMaxPrice(val);
    emitFilters({ maxPrice: val });
  };

  const handleSortChange = (val) => {
    setSortBy(val);
    emitFilters({ sortBy: val });
  };

  const handleReset = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setMinDiscount(0);
    setMinPrice('');
    setMaxPrice('');
    setSortBy('newest');
    onFiltersChange?.({
      search: '',
      category: '',
      minDiscount: 0,
      minPrice: '',
      maxPrice: '',
      sortBy: 'newest',
    });
  };

  return (
    <div className="sticky top-16 md:top-20 z-30 bg-white border-b border-gray-100 shadow-sm" data-testid="deal-finder-bar">
      {/* Compact row — always visible */}
      <div className="max-w-4xl mx-auto px-3 py-2">
        <div className="flex items-center gap-2">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search deals..."
              className="w-full bg-gray-50 rounded-lg pl-8 pr-8 py-2 text-sm border border-gray-200 focus:border-[#ee922c] focus:ring-1 focus:ring-[#ee922c]/20 outline-none transition-all"
              data-testid="finder-search-input"
            />
            {searchQuery && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort dropdown — compact */}
          <select
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-2 text-xs font-medium text-gray-700 focus:border-[#ee922c] outline-none min-w-[90px]"
            data-testid="finder-sort-select"
          >
            <option value="newest">Newest</option>
            <option value="discount">Top Discount</option>
            <option value="price_low">Lowest Price</option>
            <option value="price_high">Highest Price</option>
            <option value="popularity">Trending</option>
          </select>

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded(!expanded)}
            className={`relative flex items-center gap-1 px-2.5 py-2 rounded-lg border text-xs font-semibold transition-all ${
              expanded || activeFilterCount > 0
                ? 'bg-[#ee922c]/10 border-[#ee922c] text-[#ee922c]'
                : 'bg-gray-50 border-gray-200 text-gray-600'
            }`}
            data-testid="finder-toggle-btn"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#ee922c] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[11px] text-gray-400">
            {loading ? 'Searching...' : `${totalResults} deals found`}
          </span>
          {activeFilterCount > 0 && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-[11px] text-red-500 font-medium"
              data-testid="finder-reset-btn"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Expanded filter panel */}
      {expanded && (
        <div className="max-w-4xl mx-auto px-3 pb-3 pt-1 border-t border-gray-50" data-testid="finder-expanded-panel">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {/* Category */}
            <div className="col-span-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase mb-0.5 block">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 focus:border-[#ee922c] outline-none"
                data-testid="finder-category-select"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.id || cat.slug} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>

            {/* Discount minimum */}
            <div className="col-span-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase mb-0.5 block">Min Discount</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="range"
                  min="0"
                  max="90"
                  step="10"
                  value={minDiscount}
                  onChange={(e) => handleDiscountChange(e.target.value)}
                  className="flex-1 h-1.5 accent-[#ee922c]"
                  data-testid="finder-discount-slider"
                />
                <span className="text-xs font-bold text-[#3c7b48] min-w-[30px] text-right">{minDiscount}%</span>
              </div>
            </div>

            {/* Min price */}
            <div className="col-span-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase mb-0.5 block">Min Price</label>
              <input
                type="number"
                value={minPrice}
                onChange={(e) => handleMinPriceChange(e.target.value)}
                placeholder="₹0"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 focus:border-[#ee922c] outline-none"
                data-testid="finder-min-price"
              />
            </div>

            {/* Max price */}
            <div className="col-span-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase mb-0.5 block">Max Price</label>
              <input
                type="number"
                value={maxPrice}
                onChange={(e) => handleMaxPriceChange(e.target.value)}
                placeholder="₹99999"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 focus:border-[#ee922c] outline-none"
                data-testid="finder-max-price"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
