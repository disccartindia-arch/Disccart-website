import { useState, useEffect, useCallback, memo } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getFilterConfig } from '../lib/api';
import { Button } from './ui/button';

const PriceBracketItem = memo(function PriceBracketItem({ bracket, isSelected, onToggle }) {
  return (
    <label
      className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-all text-sm font-semibold ${isSelected ? 'bg-[#ee922c]/10 border-[#ee922c] text-[#ee922c]' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}
      data-testid={`filter-price-${bracket.label}`}
    >
      <input type="radio" name="price" checked={isSelected} onChange={onToggle} className="hidden" />
      {bracket.label}
    </label>
  );
});

const FilterCheckbox = memo(function FilterCheckbox({ item, isSelected, onToggle }) {
  return (
    <label
      className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-all text-sm font-semibold ${isSelected ? 'bg-[#3c7b48]/10 border-[#3c7b48] text-[#3c7b48]' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}
      data-testid={`filter-item-${item.name}`}
    >
      <input type="checkbox" checked={isSelected} onChange={onToggle} className="hidden" />
      {item.name}
    </label>
  );
});

export default function FilterDrawer({ onApply }) {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState(null);
  const [loaded, setLoaded] = useState(false);

  // Filter state
  const [selectedPrice, setSelectedPrice] = useState(null);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedStores, setSelectedStores] = useState([]);

  // Fetch filter config ONCE
  useEffect(() => {
    if (loaded) return;
    (async () => {
      try {
        const data = await getFilterConfig();
        setConfig(data);
        setLoaded(true);
      } catch {
        setConfig({ price_brackets: [], categories: [], stores: [] });
        setLoaded(true);
      }
    })();
  }, [loaded]);

  const toggleCategory = useCallback((name) => {
    setSelectedCategories(prev =>
      prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
    );
  }, []);

  const toggleStore = useCallback((name) => {
    setSelectedStores(prev =>
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    );
  }, []);

  const handleApply = () => {
    const filters = {};
    if (selectedPrice) {
      filters.min_price = selectedPrice.min;
      filters.max_price = selectedPrice.max;
    }
    if (selectedCategories.length > 0) {
      filters.category = selectedCategories.join(',');
    }
    if (selectedStores.length > 0) {
      filters.store = selectedStores.join(',');
    }
    onApply?.(filters);
    setIsOpen(false);
  };

  const handleClear = () => {
    setSelectedPrice(null);
    setSelectedCategories([]);
    setSelectedStores([]);
    onApply?.({});
    setIsOpen(false);
  };

  const activeCount = (selectedPrice ? 1 : 0) + selectedCategories.length + selectedStores.length;

  const visibleCategories = config?.categories?.filter(c => c.show_in_filter !== false) || [];
  const visibleStores = config?.stores?.filter(s => s.show_in_filter !== false) || [];
  const priceBrackets = config?.price_brackets || [];

  const hasFilters = priceBrackets.length > 0 || visibleCategories.length > 0 || visibleStores.length > 0;

  if (!hasFilters && loaded) return null;

  return (
    <>
      {/* Floating Filter Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full bg-[#ee922c] text-white shadow-lg shadow-orange-500/30 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
        data-testid="filter-fab"
      >
        <SlidersHorizontal className="w-6 h-6" />
        {activeCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>

      {/* Filter Drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-white z-50 shadow-2xl overflow-y-auto"
              data-testid="filter-drawer"
            >
              <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black text-gray-900">Filters</h2>
                  <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-gray-100 rounded-full" data-testid="filter-close">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Price Brackets */}
                {priceBrackets.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Price Range</h3>
                    <div className="flex flex-wrap gap-2">
                      {priceBrackets.map((b, i) => (
                        <PriceBracketItem
                          key={i}
                          bracket={b}
                          isSelected={selectedPrice?.label === b.label}
                          onToggle={() => setSelectedPrice(selectedPrice?.label === b.label ? null : b)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Categories */}
                {visibleCategories.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Categories</h3>
                    <div className="flex flex-wrap gap-2">
                      {visibleCategories.map(c => (
                        <FilterCheckbox
                          key={c.id}
                          item={c}
                          isSelected={selectedCategories.includes(c.name)}
                          onToggle={() => toggleCategory(c.name)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Stores */}
                {visibleStores.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Stores</h3>
                    <div className="flex flex-wrap gap-2">
                      {visibleStores.map(s => (
                        <FilterCheckbox
                          key={s.id}
                          item={s}
                          isSelected={selectedStores.includes(s.name)}
                          onToggle={() => toggleStore(s.name)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t">
                  <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={handleClear} data-testid="filter-clear">
                    Clear All
                  </Button>
                  <Button className="flex-1 h-12 rounded-xl bg-[#ee922c]" onClick={handleApply} data-testid="filter-apply">
                    Apply Filters
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
