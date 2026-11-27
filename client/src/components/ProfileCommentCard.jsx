import { Link } from 'react-router-dom';
import { timeAgo } from '../utils/time.js';

export default function ProfileCommentCard({ comment }) {
  const postId = comment.post;
  const postTitle = comment.postInfo?.title;
  const communityName = comment.postInfo?.communityName;

  return (
    <article className="rounded border border-reddit-border bg-reddit-surface p-3 transition hover:border-zinc-400">
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-reddit-muted">
        <span className="font-bold text-reddit-ink">{comment.author?.username}</span>
        <span>commented</span>
        {postTitle && postId && (
          <Link to={`/posts/${postId}`} className="font-semibold text-reddit-ink hover:underline">
            {postTitle}
          </Link>
        )}
        {communityName && (
          <>
            <span>•</span>
            <Link to={`/r/${communityName}`} className="font-bold hover:underline">
              r/{communityName}
            </Link>
          </>
        )}
        <span>•</span>
        <span>{timeAgo(comment.createdAt)}</span>
      </div>
      <p className="mt-2 whitespace-pre-wrap border-l-2 border-reddit-border pl-3 text-sm text-zinc-700">
        {comment.isDeleted ? '[deleted]' : comment.content}
      </p>
      <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-reddit-muted">
        <span className={comment.userVote === 1 ? 'text-reddit-orange' : 'text-zinc-400'}>▲</span>
        <span>{comment.score ?? 0}</span>
        <span className={comment.userVote === -1 ? 'text-reddit-blue' : 'text-zinc-400'}>▼</span>
      </div>
    </article>
  );
}