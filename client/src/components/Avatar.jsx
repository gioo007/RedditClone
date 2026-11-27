export default function Avatar({ user, size = 'h-8 w-8', text = 'text-sm' }) {
  if (user?.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.username}
        className={`${size} rounded-full bg-zinc-200 object-cover`}
      />
    );
  }
  return (
    <span
      className={`flex ${size} ${text} items-center justify-center rounded-full bg-reddit-orange font-bold uppercase text-white`}
    >
      {(user?.username || '?')[0]}
    </span>
  );
}