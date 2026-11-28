import { useState } from 'react';
import api from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function EditProfileModal({ profile, onClose, onSaved }) {
  const { setUser } = useAuth();
  const [form, setForm] = useState({
    displayName: profile.displayName || '',
    bio: profile.bio || '',
    avatarUrl: profile.avatarUrl || '',
    bannerUrl: profile.bannerUrl || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await api.users.updateMe(form);
      setUser((prev) => ({ ...prev, ...res.data }));
      onSaved(res.data);
    } catch (err) {
      const first = err.details?.[0];
      setError(first ? `${first.field}: ${first.message}` : err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-4 rounded bg-reddit-surface p-5 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-reddit-ink">Edit profile</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xl leading-none text-reddit-muted hover:text-reddit-ink"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <Field label="Display name" hint={`${form.displayName.length}/50`}>
          <input
            value={form.displayName}
            onChange={set('displayName')}
            maxLength={50}
            className="input"
          />
        </Field>

        <Field label="About you" hint={`${form.bio.length}/500`}>
          <textarea
            value={form.bio}
            onChange={set('bio')}
            maxLength={500}
            rows={4}
            className="input resize-none"
          />
        </Field>

        <Field label="Avatar image URL">
          <input
            value={form.avatarUrl}
            onChange={set('avatarUrl')}
            placeholder="https://..."
            className="input"
          />
        </Field>

        <Field label="Banner image URL">
          <input
            value={form.bannerUrl}
            onChange={set('bannerUrl')}
            placeholder="https://..."
            className="input"
          />
        </Field>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-reddit-blue px-4 py-1.5 text-sm font-bold text-reddit-blue hover:bg-blue-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-reddit-blue px-4 py-1.5 text-sm font-bold text-white hover:bg-reddit-blueHover disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <div className="mb-1 flex justify-between text-xs font-semibold text-reddit-muted">
        <span>{label}</span>
        {hint && <span className="font-normal">{hint}</span>}
      </div>
      {children}
    </label>
  );
}
