import Avatar from './Avatar.jsx';
import { formatDate } from '../utils/time.js';

export default function ProfileSidebar({ profile, isOwn, onEdit }) {
  const total = (profile.karma?.post || 0) + (profile.karma?.comment || 0);

  return (
    <div className="overflow-hidden rounded border border-reddit-border bg-reddit-surface">
      <div
        className="h-20 bg-reddit-blue bg-cover bg-center"
        style={profile.bannerUrl ? { backgroundImage: `url(${profile.bannerUrl})` } : undefined}
      />
      <div className="px-4 pb-4">
        <div className="-mt-8 mb-2 w-fit rounded-full border-4 border-reddit-surface">
          <Avatar user={profile} size="h-16 w-16" text="text-2xl" />
        </div>

        <h2 className="text-lg font-bold leading-tight text-reddit-ink">
          {profile.displayName || profile.username}
        </h2>
        <p className="text-xs text-reddit-muted">u/{profile.username}</p>

        {profile.bio && <p className="mt-3 text-sm text-zinc-700">{profile.bio}</p>}

        {isOwn && (
          <button
            type="button"
            onClick={onEdit}
            className="mt-3 w-full rounded-full bg-reddit-blue py-1.5 text-sm font-bold text-white transition hover:bg-reddit-blueHover"
          >
            Edit profile
          </button>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-reddit-border pt-3">
          <Stat label="Karma" value={total} />
          <Stat label="Cake day" value={formatDate(profile.createdAt)} small />
          <Stat label="Post karma" value={profile.karma?.post || 0} />
          <Stat label="Comment karma" value={profile.karma?.comment || 0} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, small }) {
  return (
    <div>
      <div className={`${small ? 'text-xs' : 'text-sm'} font-semibold text-reddit-ink`}>{value}</div>
      <div className="text-xs text-reddit-muted">{label}</div>
    </div>
  );
}