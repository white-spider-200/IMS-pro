import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';

interface AutocompleteSearchProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
}

export default function AutocompleteSearch({ 
  value, 
  onChange, 
  suggestions, 
  placeholder = "Search...", 
  className 
}: AutocompleteSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        handleSelect(suggestions[activeIndex]);
      } else {
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelect = (suggestion: string) => {
    const words = value.split(/\s+/);
    const lastWord = words[words.length - 1] || '';
    
    if (suggestion.toLowerCase().startsWith(lastWord.toLowerCase()) && lastWord !== '') {
      words[words.length - 1] = suggestion;
    } else {
      if (words[words.length - 1] === '') {
        words[words.length - 1] = suggestion;
      } else {
        words.push(suggestion);
      }
    }
    
    const newValue = words.join(' ').trim();
    onChange(newValue + (suggestion.endsWith(':') ? '' : ' '));
    setIsOpen(false);
    setActiveIndex(-1);
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input 
        type="text" 
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        className="w-full bg-gray-50 border-none rounded-xl py-2 pl-10 pr-10 text-sm focus:ring-2 focus:ring-black transition-all"
      />
      {value && (
        <button 
          onClick={() => {
            onChange('');
            setIsOpen(false);
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full transition-colors"
        >
          <X className="w-3 h-3 text-gray-400" />
        </button>
      )}

      <AnimatePresence>
        {isOpen && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 max-h-64 overflow-y-auto"
          >
            <div className="p-2">
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion}
                  onClick={() => handleSelect(suggestion)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    "w-full text-left px-4 py-2.5 rounded-xl text-sm transition-colors flex items-center justify-between group",
                    activeIndex === index ? "bg-black text-white" : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  <span className="font-medium">{suggestion}</span>
                  {suggestion.endsWith(':') && (
                    <span className={cn(
                      "text-[10px] uppercase tracking-widest font-bold",
                      activeIndex === index ? "text-gray-400" : "text-gray-300"
                    )}>
                      Filter
                    </span>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
