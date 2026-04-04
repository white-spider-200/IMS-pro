import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface Option {
    value: string;
    label: string;
    subLabel?: string;
}

interface SearchableSelectProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    error?: boolean;
}

export default function SearchableSelect({
    options,
    value,
    onChange,
    placeholder = 'Select...',
    disabled = false,
    className,
    error = false,
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = useMemo(() => options.find((o) => o.value === value), [options, value]);

    const filteredOptions = useMemo(() => {
        if (!searchTerm) return options;
        const lowerSearch = searchTerm.toLowerCase();
        return options.filter(
            (o) =>
                o.label.toLowerCase().includes(lowerSearch) ||
                (o.subLabel && o.subLabel.toLowerCase().includes(lowerSearch))
        );
    }, [options, searchTerm]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!isOpen) {
            setSearchTerm('');
        }
    }, [isOpen]);

    const toggleDropdown = () => {
        if (!disabled) setIsOpen(!isOpen);
    };

    return (
        <div ref={containerRef} className={cn("relative w-full", className)}>
            <div
                onClick={toggleDropdown}
                className={cn(
                    "flex min-h-[44px] w-full items-center justify-between rounded-xl border bg-white/70 px-4 py-2 text-sm shadow-sm transition-all cursor-pointer",
                    disabled ? "opacity-50 cursor-not-allowed bg-gray-50" : "hover:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100",
                    error ? "border-amber-400 focus-within:ring-amber-100" : "border-slate-200",
                    isOpen ? "border-indigo-400 ring-2 ring-indigo-100" : ""
                )}
            >
                <div className="flex flex-1 items-center gap-2 overflow-hidden truncate whitespace-nowrap">
                    {selectedOption ? (
                        <span className="text-slate-800 font-medium truncate">{selectedOption.label}</span>
                    ) : (
                        <span className="text-slate-400">{placeholder}</span>
                    )}
                </div>
                <div className="flex items-center gap-1 ml-2 shrink-0">
                    {value && !disabled && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange('');
                            }}
                            className="p-1 hover:bg-slate-100 rounded-full text-slate-400 transition"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", isOpen ? "rotate-180" : "")} />
                </div>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.15 }}
                        className="absolute z-50 mt-1.5 w-full rounded-2xl border border-slate-100 bg-white p-1.5 shadow-xl"
                    >
                        <div className="relative mb-1.5">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                autoFocus
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full rounded-xl bg-slate-50 border-none pl-9 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-100"
                            />
                        </div>

                        <div className="max-h-60 overflow-y-auto hidden-scrollbar">
                            {filteredOptions.length === 0 ? (
                                <div className="p-4 text-center text-sm text-slate-400">No results found.</div>
                            ) : (
                                filteredOptions.map((option) => {
                                    const isSelected = option.value === value;
                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => {
                                                onChange(option.value);
                                                setIsOpen(false);
                                            }}
                                            className={cn(
                                                "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors",
                                                isSelected ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-slate-50"
                                            )}
                                        >
                                            <div className="flex flex-col overflow-hidden">
                                                <span className={cn("truncate", isSelected ? "font-bold" : "font-medium")}>
                                                    {option.label}
                                                </span>
                                                {option.subLabel && (
                                                    <span className="truncate text-xs text-slate-400">{option.subLabel}</span>
                                                )}
                                            </div>
                                            {isSelected && <Check className="w-4 h-4 ml-2 shrink-0" />}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
