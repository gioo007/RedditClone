import { API_BASE_URL, USE_MOCKS } from '../api/index.js';
import { MOCK_POSTS } from '../api/mockData.js';
import { useApiHealth } from '../hooks/useApiHealth.js';

export default function HomePage() {
  const { loading, health, error } = useApiHealth();
  const samplePost = MOCK_POSTS[0];

  return (
    <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-3">
      <section className="space-y-4 lg:col-span-2">
        <div className="rounded border border-reddit-border bg-reddit-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-base font-bold text-reddit-ink">
              Hello World — Phase 0 Foundation Ready
            </h1>
            <span className="text-xs text-reddit-muted">Target API: {API_BASE_URL}</span>
          </div>

          <p className="mt-2 text-sm text-zinc-700">
            Both apps are scaffolded and wired to the shared OpenAPI contract. Switch{' '}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">VITE_USE_MOCKS</code> in{' '}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">client/.env</code> to toggle
            between the Express backend and the local mock adapter.
          </p>

          <div className="mt-3 rounded bg-zinc-50 p-3 text-xs">
            {loading && <span className="text-reddit-muted">Checking /api/health...</span>}
            {!loading && health && (
              <div className="flex flex-wrap items-center gap-3 text-emerald-700">
                <span className="font-semibold">Backend Status: {health.status.toUpperCase()}</span>
                <span>Database: {health.database}</span>
                <span>Mode: {USE_MOCKS ? 'Mock Adapter' : 'Express REST API'}</span>
              </div>
            )}
            {!loading && error && (
              <div className="text-amber-700">
                Could not reach live backend ({error}). Start{' '}
                <code className="font-mono">npm run dev</code> in{' '}
                <code className="font-mono">server/</code> or set{' '}
                <code className="font-mono">VITE_USE_MOCKS=true</code>.
              </div>
            )}
          </div>
        </div>

        <article className="flex rounded border border-reddit-border bg-reddit-surface transition hover:border-zinc-400">
          <div className="flex w-10 flex-col items-center gap-1 rounded-l bg-zinc-50 py-3 text-xs font-bold text-zinc-700">
            <span className="text-reddit-orange">▲</span>
            <span>{samplePost.score}</span>
            <span className="text-zinc-400">▼</span>
          </div>
          <div className="flex-1 p-3">
            <div className="flex items-center gap-1.5 text-xs text-reddit-muted">
              <span className="font-bold text-reddit-ink">r/{samplePost.community.name}</span>
              <span>•</span>
              <span>Posted by u/{samplePost.author.username}</span>
            </div>
            <h2 className="mt-1 text-base font-semibold text-reddit-ink">{samplePost.title}</h2>
            <p className="mt-1.5 text-sm text-zinc-700">{samplePost.content}</p>
            <div className="mt-3 flex items-center gap-4 text-xs font-semibold text-reddit-muted">
              <span>{samplePost.commentCount} Comments</span>
              <span>Summarize with AI</span>
              <span>Share</span>
            </div>
          </div>
        </article>
      </section>

      <aside className="space-y-4">
        <div className="overflow-hidden rounded border border-reddit-border bg-reddit-surface">
          <div className="h-9 bg-reddit-blue px-4 py-2 text-xs font-bold uppercase tracking-wider text-white">
            Phase 0 Deliverables
          </div>
          <ul className="space-y-2 p-4 text-xs text-zinc-700">
            <li>• Express server + Swagger UI (/api/docs)</li>
            <li>• 6 Mongoose schema skeletons committed</li>
            <li>• OpenAPI 3.0 contract (docs/openapi.yaml)</li>
            <li>• Cursor pagination + error envelope</li>
            <li>• Auth & voting parallel work stubs</li>
            <li>• React + Tailwind + VITE_USE_MOCKS client</li>
          </ul>
        </div>
      </aside>
    </main>
  );
}
