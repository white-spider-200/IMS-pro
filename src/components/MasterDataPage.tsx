import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, onSnapshot, query, where, orderBy, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { Plus, Search, MoreVertical, Edit2, Trash2, X, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { cn } from '../lib/utils';
import AutocompleteSearch from './AutocompleteSearch';

interface MasterDataProps {
  collectionName: string;
  title: string;
  fields: {
    key: string;
    label: string;
    type: 'text' | 'number' | 'select';
    options?: { label: string; value: string }[];
    required?: boolean;
  }[];
  sortField?: string;
}

export default function MasterDataPage({ collectionName, title, fields, sortField = 'name' }: MasterDataProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingItem, setViewingItem] = useState<any>(null);

  useEffect(() => {
    const q = query(collection(db, collectionName), orderBy(sortField, 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setData(items);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, collectionName);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [collectionName, sortField]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      toast.error('You must be signed in to perform this action');
      return;
    }
    try {
      if (editingId) {
        try {
          await updateDoc(doc(db, collectionName, editingId), {
            ...formData,
            last_modified: new Date().toISOString()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `${collectionName}/${editingId}`);
        }
        toast.success(`${title} updated successfully`);
      } else {
        try {
          await addDoc(collection(db, collectionName), {
            ...formData,
            status: formData.status || 'active',
            created_at: new Date().toISOString(),
            last_modified: new Date().toISOString()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, collectionName);
        }
        toast.success(`${title} created successfully`);
      }
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({});
    } catch (error: any) {
      console.error(error);
      let message = 'Operation failed';
      try {
        const errObj = JSON.parse(error.message);
        message = errObj.error;
      } catch (e) {
        message = error.message || message;
      }
      toast.error(message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await updateDoc(doc(db, collectionName, id), { status: 'inactive' });
      toast.success(`${title} deactivated`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${collectionName}/${id}`);
    }
  };

  const filteredData = data.filter(item => {
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();
    
    // Parse advanced filters: key:value or key:"value"
    const filterRegex = /(\w+):(?:"([^"]+)"|(\S+))/g;
    let match;
    const activeFilters: Record<string, string[]> = {};
    let hasAdvancedFilters = false;

    // Extract all filters
    let remainingSearch = searchTerm;
    while ((match = filterRegex.exec(searchTerm)) !== null) {
      hasAdvancedFilters = true;
      const key = match[1].toLowerCase();
      const value = (match[2] || match[3]).toLowerCase();
      if (!activeFilters[key]) activeFilters[key] = [];
      activeFilters[key].push(value);
      remainingSearch = remainingSearch.replace(match[0], '');
    }

    const cleanSearch = remainingSearch.trim().toLowerCase();

    if (hasAdvancedFilters) {
      // Apply advanced filters (AND between different keys, OR between same keys)
      // We check if the item has a property matching the key
      const filterMatches = Object.entries(activeFilters).every(([key, values]) => {
        // Find if any field key matches (case-insensitive)
        const field = fields.find(f => f.key.toLowerCase() === key || f.label.toLowerCase() === key);
        if (!field) return true; // Ignore unknown filters or handle them as general search? Let's ignore for now.

        const itemValue = String((item as any)[field.key] || '').toLowerCase();
        
        // If it's a select field, we might want to match against the option label too
        if (field.type === 'select' && field.options) {
          const option = field.options.find(o => o.value === (item as any)[field.key]);
          const optionLabel = option ? option.label.toLowerCase() : '';
          return (values as string[]).some(v => itemValue.includes(v) || optionLabel.includes(v));
        }

        return (values as string[]).some(v => itemValue.includes(v));
      });

      // If there's remaining text, it must match something too
      const matchesGeneral = !cleanSearch || Object.values(item).some(val => 
        String(val).toLowerCase().includes(cleanSearch)
      );

      return filterMatches && matchesGeneral;
    }

    // Default simple search
    return Object.values(item).some(val => 
      String(val).toLowerCase().includes(searchLower)
    );
  });

  const getSuggestions = () => {
    const words = searchTerm.split(' ');
    const lastWord = words[words.length - 1];
    const searchLower = lastWord.toLowerCase();

    // Suggest keys based on field labels
    const keys = fields.map(f => `${f.label.toLowerCase()}:`);

    if (!lastWord.includes(':')) {
      return keys.filter(k => k.startsWith(searchLower));
    }

    // Suggest values for a key
    const [key, value] = lastWord.split(':');
    const valLower = value.toLowerCase();

    const field = fields.find(f => f.label.toLowerCase() === key || f.key.toLowerCase() === key);
    if (field) {
      if (field.type === 'select' && field.options) {
        return field.options
          .filter(o => o.label.toLowerCase().includes(valLower))
          .map(o => `${key}:"${o.label}"`);
      }
      
      // For other fields, suggest unique values from data
      return Array.from(new Set(data.map((item: any) => String(item[field.key] || ''))))
        .filter((v: string) => v && v.toLowerCase().includes(valLower))
        .map((v: string) => v.includes(' ') ? `${key}:"${v}"` : `${key}:${v}`);
    }

    return [];
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-gray-500 text-sm">Manage your {title.toLowerCase()} reference data.</p>
        </div>
        <button 
          onClick={() => {
            setEditingId(null);
            setFormData({});
            setIsModalOpen(true);
          }}
          className="bg-black text-white px-4 py-2 rounded-xl font-semibold flex items-center gap-2 hover:bg-gray-800 transition-all shadow-lg"
        >
          <Plus className="w-5 h-5" />
          Add {title}
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-4">
          <div className="flex-1 relative">
            <AutocompleteSearch 
              value={searchTerm}
              onChange={setSearchTerm}
              suggestions={getSuggestions()}
              placeholder={`Search ${title.toLowerCase()}...`}
              className="w-full"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button className="p-2 hover:bg-gray-100 rounded-lg">
            <Filter className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                {fields.map(f => (
                  <th key={f.key} className="px-6 py-4 font-semibold">{f.label}</th>
                ))}
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={fields.length + 2} className="px-6 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />
                      Loading...
                    </div>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={fields.length + 2} className="px-6 py-12 text-center text-gray-400">
                    No records found.
                  </td>
                </tr>
              ) : filteredData.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                  {fields.map(f => (
                    <td key={f.key} className="px-6 py-4 text-sm font-medium text-gray-700">
                      {f.type === 'select' 
                        ? f.options?.find(o => o.value === item[f.key])?.label || item[f.key]
                        : item[f.key]}
                    </td>
                  ))}
                  <td className="px-6 py-4">
                    <span className={cn(
                      "text-[10px] uppercase font-bold px-2 py-1 rounded-full",
                      item.status === 'active' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    )}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => setViewingItem(item)}
                        className="p-2 hover:bg-gray-200 rounded-lg text-gray-600"
                        title="View Details"
                      >
                        <Search className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => {
                          setEditingId(item.id);
                          setFormData(item);
                          setIsModalOpen(true);
                        }}
                        className="p-2 hover:bg-gray-200 rounded-lg text-gray-600"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="p-2 hover:bg-red-100 rounded-lg text-red-500"
                        title="Deactivate"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Modal */}
      <AnimatePresence>
        {viewingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingItem(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-xl font-bold">{title} Details</h3>
                <button onClick={() => setViewingItem(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  {fields.map(f => (
                    <div key={f.key}>
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">{f.label}</label>
                      <p className="text-sm font-bold text-gray-800">
                        {f.type === 'select' 
                          ? f.options?.find(o => o.value === viewingItem[f.key])?.label || viewingItem[f.key] || 'N/A'
                          : viewingItem[f.key] || 'N/A'}
                      </p>
                    </div>
                  ))}
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Status</label>
                    <span className={cn(
                      "text-[10px] uppercase font-bold px-2 py-1 rounded-full",
                      viewingItem.status === 'active' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    )}>
                      {viewingItem.status}
                    </span>
                  </div>
                </div>
                
                <div className="pt-6 border-t border-gray-100 grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Created At</label>
                    <p className="text-xs text-gray-500">
                      {viewingItem.created_at ? new Date(viewingItem.created_at).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Last Modified</label>
                    <p className="text-xs text-gray-500">
                      {viewingItem.last_modified ? new Date(viewingItem.last_modified).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    onClick={() => setViewingItem(null)}
                    className="w-full bg-black text-white py-3 rounded-xl font-semibold hover:bg-gray-800 transition-all shadow-lg"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-xl font-bold">{editingId ? 'Edit' : 'Add'} {title}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {fields.map(f => (
                  <div key={f.key} className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{f.label}</label>
                    {f.type === 'select' ? (
                      <select 
                        required={f.required}
                        value={formData[f.key] || ''}
                        onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                        className="w-full bg-gray-50 border-gray-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-black transition-all"
                      >
                        <option value="">Select {f.label}</option>
                        {f.options?.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : (
                      <input 
                        type={f.type}
                        required={f.required}
                        value={formData[f.key] || ''}
                        onChange={(e) => setFormData({ ...formData, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
                        className="w-full bg-gray-50 border-gray-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-black transition-all"
                      />
                    )}
                  </div>
                ))}
                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-black text-white py-3 rounded-xl font-semibold hover:bg-gray-800 transition-all shadow-lg"
                  >
                    {editingId ? 'Save Changes' : `Add ${title}`}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
