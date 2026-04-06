import React, { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Camera, MapPin, Phone, Save, User } from 'lucide-react';
import { toast } from 'sonner';
import { saveDemoProfile } from '../demo/demoProfile';
import { api } from '../lib/api';
import { getToken } from '../lib/localAuth';

type OutletContext = {
  isDemoMode?: boolean;
  effectiveUser?: any;
  currentUserProfile?: any;
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const { isDemoMode, effectiveUser, currentUserProfile } = useOutletContext<OutletContext>();
  const [formData, setFormData] = useState({
    displayName: '',
    phone: '',
    location: '',
    photoURL: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFormData({
      displayName: currentUserProfile?.displayName || effectiveUser?.displayName || '',
      phone: currentUserProfile?.phone || '',
      location: currentUserProfile?.location || '',
      photoURL: currentUserProfile?.photoURL || effectiveUser?.photoURL || '',
    });
  }, [currentUserProfile, effectiveUser]);

  const handleChange = (key: keyof typeof formData, value: string) => {
    setFormData((current) => ({ ...current, [key]: value }));
  };

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (result) {
        handleChange('photoURL', result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (isDemoMode) {
        saveDemoProfile({
          displayName: formData.displayName.trim() || 'Local Demo User',
          email: effectiveUser?.email || 'demo@localhost',
          phone: formData.phone.trim(),
          location: formData.location.trim(),
          photoURL: formData.photoURL.trim(),
        });
        toast.success('Demo profile updated');
        navigate('/');
        return;
      }

      if (!getToken()) {
        throw new Error('You must be signed in to update your profile');
      }

      await api.put('/auth/me', {
        displayName: formData.displayName.trim(),
        phone: formData.phone.trim(),
        location: formData.location.trim(),
        photoURL: formData.photoURL.trim(),
      });

      toast.success('Profile updated successfully');
      navigate('/');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const previewSrc =
    formData.photoURL.trim() ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.displayName || effectiveUser?.displayName || 'User')}`;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="app-surface overflow-hidden">
        <div className="border-b border-gray-200 px-8 py-8">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-gray-400">Account</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">Profile Settings</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-500">
            Update your personal information and choose the photo shown in the sidebar and account areas.
          </p>
        </div>

        <div className="grid gap-8 px-8 py-8 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="app-muted-surface p-6">
            <div className="mx-auto flex h-44 w-44 items-center justify-center overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <img src={previewSrc} alt="Profile preview" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
                <User className="h-5 w-5 text-gray-400" />
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Name</p>
                  <p className="truncate font-semibold text-gray-800">{formData.displayName || effectiveUser?.displayName || 'Unnamed user'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
                <Phone className="h-5 w-5 text-gray-400" />
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Phone</p>
                  <p className="truncate font-semibold text-gray-800">{formData.phone || 'Not set'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
                <MapPin className="h-5 w-5 text-gray-400" />
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Location</p>
                  <p className="truncate font-semibold text-gray-800">{formData.location || 'Not set'}</p>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-400">Display Name</span>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => handleChange('displayName', e.target.value)}
                  className="app-field"
                  placeholder="Your name"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-400">Phone Number</span>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="app-field"
                  placeholder="+962 ..."
                  required
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-400">Location</span>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
                className="app-field"
                placeholder="Amman, Jordan"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-400">
                <Camera className="h-4 w-4" />
                Photo URL
              </span>
              <input
                type="url"
                value={formData.photoURL}
                onChange={(e) => handleChange('photoURL', e.target.value)}
                className="app-field"
                placeholder="https://..."
              />
              <p className="mt-2 text-sm text-gray-500">
                Paste a public image URL to use as your profile photo.
              </p>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-400">Or Upload Photo</span>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoFileChange}
                className="w-full rounded-xl border border-dashed border-gray-300 bg-gray-50 px-5 py-4 font-medium text-gray-700 outline-none transition focus:border-gray-900 focus:bg-white"
              />
              <p className="mt-2 text-sm text-gray-500">
                Uploading stores the image directly in the demo profile as a local data URL.
              </p>
            </label>

            <div className="flex flex-wrap gap-3 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="app-button-primary px-6 py-3.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-5 w-5" />
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="app-button-secondary px-6 py-3.5"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
