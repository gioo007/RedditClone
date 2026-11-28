import { Link } from 'react-router-dom';
import { timeAgo } from '../utils/time.js';

export default function ProfilePostCard({ post }) {
  return (
    <article className="flex rounded border border-reddit-border bg-reddit-surface transition hover:border-zinc-400">
      <div className="flex w-10 flex-col items-center gap-1 rounded-l bg-zinc-50 py-3 text-xs font-bold text-zinc-700">
        <span className={post.userVote === 1 ? 'text-reddit-orange' : 'text-zinc-400'}>▲</span>
        <span>{post.score ?? 0}</span>
        <span className={post.userVote === -1 ? 'text-reddit-blue' : 'text-zinc-400'}>▼</span>
      </div>
      <div className="min-w-0 flex-1 p-3">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-reddit-muted">
          {post.community?.name && (
            <Link
              to={`/r/${post.community.name}`}
              className="font-bold text-reddit-ink hover:underline"
            >
              r/{post.community.name}
            </Link>
          )}
          <span>•</span>
          <span>Posted by u/{post.author?.username}</span>
          <span>{timeAgo(post.createdAt)}</span>
        </div>
        <Link to={`/posts/${post._id}`}>
          <h2 className="mt-1 text-base font-semibold text-reddit-ink">
            {post.isDeleted ? '[deleted]' : post.title}
          </h2>
        </Link>
        {post.content && !post.isDeleted && (
          <p className="mt-1.5 line-clamp-3 text-sm text-zinc-700">{post.content}</p>
        )}
        <div className="mt-3 text-xs font-semibold text-reddit-muted">
          {post.commentCount ?? 0} Comments
        </div>
      </div>
    </article>
  );
}
