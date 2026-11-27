import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import EditProfileModal from '../components/EditProfileModal.jsx';
import ProfileCommentCard from '../components/ProfileCommentCard.jsx';
import ProfilePostCard from '../components/ProfilePostCard.jsx';
import ProfileSidebar from '../components/ProfileSidebar.jsx';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'posts', label: 'Posts' },
  { key: 'comments', label: 'Comments' },
];

export default function ProfilePage() {
  const { username } = useParams();
  const { user, token, setUser } = useAuth();

  const [profile, setProfile] = useState(null);
  const [profileState, setProfileState] = useState('loading'); 
  const [tab, setTab] = useState('overview');
  const [sort, setSort] = useState('new');
  const [items, setItems] = useState([]); 
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (token && !user) {
      api.auth
        .me()
        .then((res) => setUser(res.data))
        .catch(() => {});
    }
  }, [token, user, setUser]);

  const isOwn = Boolean(user && profile && user.username === profile.username);

  
  useEffect(() => {
    let cancelled = false;
    setProfileState('loading');
    api.users
      .getProfile(username)
      .then((res) => {
        if (cancelled) return;
        setProfile(res.data);
        setProfileState('ok');
      })
      .catch((err) => {
        if (cancelled) return;
        setProfileState(err.statusCode === 404 ? 'notfound' : 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [username]);

  useEffect(() => {
    let cancelled = false;
    setListLoading(true);
    setItems([]);
    setCursor(null);
    setHasMore(false);

    async function load() {
      try {
        if (tab === 'posts') {
          const res = await api.users.listPosts(username, { sort, limit: 10 });
          if (cancelled) return;
          setItems(res.data.map((data) => ({ type: 'post', data })));
          setCursor(res.pagination?.nextCursor || null);
          setHasMore(Boolean(res.pagination?.hasMore));
        } else if (tab === 'comments') {
          const res = await api.users.listComments(username, { limit: 10 });
          if (cancelled) return;
          setItems(res.data.map((data) => ({ type: 'comment', data })));
          setCursor(res.pagination?.nextCursor || null);
          setHasMore(Boolean(res.pagination?.hasMore));
        } else {
          const [p, c] = await Promise.all([
            api.users.listPosts(username, { sort: 'new', limit: 10 }),
            api.users.listComments(username, { limit: 10 }),
          ]);
          if (cancelled) return;
          const merged = [
            ...p.data.map((data) => ({ type: 'post', data })),
            ...c.data.map((data) => ({ type: 'comment', data })),
          ].sort((a, b) => new Date(b.data.createdAt) - new Date(a.data.createdAt));
          setItems(merged);
        }
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setListLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [username, tab, sort]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const isPosts = tab === 'posts';
      const res = isPosts
        ? await api.users.listPosts(username, { sort, limit: 10, cursor })
        : await api.users.listComments(username, { limit: 10, cursor });
      const type = isPosts ? 'post' : 'comment';
      setItems((prev) => [...prev, ...res.data.map((data) => ({ type, data }))]);
      setCursor(res.pagination?.nextCursor || null);
      setHasMore(Boolean(res.pagination?.hasMore));
    } finally {
      setLoadingMore(false);
    }
  }

  if (profileState === 'loading') {
    return <p className="mx-auto max-w-6xl px-4 py-10 text-sm text-reddit-muted">Loading...</p>;
  }
  if (profileState === 'notfound') {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-reddit-ink">Sorry, nobody on Reddit goes by that name.</h1>
        <p className="mt-2 text-sm text-reddit-muted">u/{username} doesn&apos;t exist.</p>
      </div>
    );
  }
  if (profileState === 'error') {
    return (
      <p className="mx-auto max-w-6xl px-4 py-10 text-sm text-red-600">
        Something went wrong loading this profile.
      </p>
    );
  }

  return (
    <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-3">
      <section className="space-y-3 lg:col-span-2">
        <div className="flex items-center gap-1 rounded border border-reddit-border bg-reddit-surface px-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`border-b-2 px-3 py-2.5 text-sm font-bold transition ${
                tab === t.key
                  ? 'border-reddit-blue text-reddit-blue'
                  : 'border-transparent text-reddit-muted hover:text-reddit-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'posts' && (
          <div className="flex gap-2 rounded border border-reddit-border bg-reddit-surface p-2">
            {['new', 'top'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSort(s)}
                className={`rounded-full px-3 py-1 text-sm font-bold capitalize ${
                  sort === s ? 'bg-zinc-200 text-reddit-ink' : 'text-reddit-muted hover:bg-zinc-100'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {listLoading && <p className="py-6 text-center text-sm text-reddit-muted">Loading...</p>}

        {!listLoading && items.length === 0 && (
          <div className="rounded border border-reddit-border bg-reddit-surface p-10 text-center">
            <p className="text-sm font-semibold text-reddit-ink">
              u/{profile.username} hasn&apos;t {tab === 'comments' ? 'commented' : 'posted'} yet
            </p>
          </div>
        )}

        {!listLoading &&
          items.map((item) =>
            item.type === 'post' ? (
              <ProfilePostCard key={`p-${item.data._id}`} post={item.data} />
            ) : (
              <ProfileCommentCard key={`c-${item.data._id}`} comment={item.data} />
            )
          )}

        {hasMore && tab !== 'overview' && (
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="w-full rounded-full border border-reddit-blue py-2 text-sm font-bold text-reddit-blue hover:bg-blue-50 disabled:opacity-60"
          >
            {loadingMore ? 'Loading...' : 'Load more'}
          </button>
        )}
      </section>

      <aside>
        <ProfileSidebar profile={profile} isOwn={isOwn} onEdit={() => setEditing(true)} />
      </aside>

      {editing && (
        <EditProfileModal
          profile={profile}
          onClose={() => setEditing(false)}
          onSaved={(updated) => {
            setProfile((p) => ({ ...p, ...updated }));
            setEditing(false);
          }}
        />
      )}
    </main>
  );
}