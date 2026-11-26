import { Link } from 'react-router-dom';
import { API_BASE_URL, USE_MOCKS } from '../api/index.js';

export default function Navbar() {
  const docsUrl = `${API_BASE_URL}/docs`;

  return (
    <header className="sticky top-0 z-30 border-b border-reddit-border bg-reddit-surface">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-4 px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-reddit-orange text-sm font-extrabold text-white">
            r/
          </span>
          <span className="text-lg font-bold tracking-tight text-reddit-ink">reddit</span>
        </Link>

        <div className="hidden max-w-md flex-1 sm:block">
          <input
            type="search"
            disabled
            placeholder="Search communities and users (Phase 4)"
            className="w-full rounded-full border border-reddit-border bg-zinc-100 px-4 py-1.5 text-sm text-reddit-muted"
          />
        </div>

        <div className="flex items-center gap-2.5">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              USE_MOCKS ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            {USE_MOCKS ? 'MOCK API' : 'LIVE API'}
          </span>
          <a
            href={docsUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-reddit-orange px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-reddit-orangeHover"
          >
            API Contract
          </a>
        </div>
      </div>
    </header>
  );
}
