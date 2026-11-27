import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { SAMPLE_COMMUNITIES, SAMPLE_USERS } from '../api/searchSamples.js';

export default function SearchBar() {
  const inputId = useId();
  const [searchTerm, setSearchTerm] = useState('');
  const query = searchTerm.trim().toLowerCase();
  const communities = query
    ? SAMPLE_COMMUNITIES.filter(({ name }) => name.toLowerCase().includes(query))
    : [];
  const users = query
    ? SAMPLE_USERS.filter(({ username }) => username.toLowerCase().includes(query))
    : [];
  const noResults = communities.length === 0 && users.length === 0;

  return (
    <div role="search" className="relative max-w-md flex-1">
      <label htmlFor={inputId} className="sr-only">
        Search communities and users
      </label>
      <input
        id={inputId}
        type="text"
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
        placeholder="Search communities and users"
        className="w-full rounded-full border border-reddit-border bg-zinc-100 py-1.5 pl-4 pr-9 text-sm text-reddit-ink"
      />
      {searchTerm && (
        <button
          type="button"
          onClick={() => setSearchTerm('')}
          aria-label="Clear search"
          className="absolute right-2 top-0 h-8 w-6 text-lg text-reddit-muted"
        >
          ×
        </button>
      )}
      {query && (
        <div className="absolute inset-x-0 top-full mt-2 max-h-80 overflow-y-auto rounded-xl border border-reddit-border bg-reddit-surface p-3 text-sm text-reddit-ink shadow-lg">
          {communities.length > 0 && (
            <section aria-label="Communities">
              <h2 className="font-semibold">Communities</h2>
              <ul>
                {communities.map(({ id, name }) => (
                  <li key={id}>
                    <Link to={`/r/${encodeURIComponent(name)}`} className="block py-1 hover:underline">
                      r/{name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {users.length > 0 && (
            <section aria-label="People">
              <h2 className="font-semibold">People</h2>
              <ul>
                {users.map(({ id, username }) => (
                  <li key={id}>
                    <Link to={`/user/${encodeURIComponent(username)}`} className="block py-1 hover:underline">
                      u/{username}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {noResults && <p role="status">No results for “{searchTerm.trim()}”.</p>}
        </div>
      )}
    </div>
  );
}
