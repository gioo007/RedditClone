import { useEffect, useRef, useState } from 'react';
import { votePost, voteComment } from '../api/Votes.js';
import './VoteButtons.css';

function formatScore(n) {
  const abs = Math.abs(n);

  if (abs >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }

  if (abs >= 1_000) {
    return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  }

  return String(n);
}

function Arrow({ filled, down }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={down ? { transform: 'rotate(180deg)' } : undefined}
    >
      <path
        d="M12 3 3.5 12.5H9V21h6v-8.5h5.5z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Reusable Reddit-style voting component.
 *
 * Supports both posts and comments.
 *
 * Vote values:
 *  1 = Upvote
 * -1 = Downvote
 *  0 = No vote
 */
export default function VoteButtons({
  postId,
  commentId,
  targetType = 'Post',
  score = 0,
  userVote = 0,
  isAuthenticated,
  onRequireLogin,
  onVoteChange,
}) {
  const [view, setView] = useState({
    score,
    vote: userVote,
  });

  const [error, setError] = useState('');

  // Last state confirmed by the server.
  const confirmed = useRef({
    score,
    vote: userVote,
  });

  // Latest vote requested by the user.
  const desired = useRef(userVote);

  // Prevent overlapping API requests.
  const inFlight = useRef(false);

  // Synchronize with updated parent data.
  useEffect(() => {
    if (inFlight.current) return;

    confirmed.current = {
      score,
      vote: userVote,
    };

    desired.current = userVote;

    setView({
      score,
      vote: userVote,
    });
  }, [score, userVote]);

  // Process voting requests sequentially.
  const flush = async () => {
    if (inFlight.current) return;

    inFlight.current = true;

    try {
      while (desired.current !== confirmed.current.vote) {
        const sent = desired.current;

        let data;

        try {
          data =
            targetType === 'Comment'
              ? await voteComment(commentId, sent)
              : await votePost(postId, sent);
        } catch (err) {
          // Restore the last confirmed state.
          desired.current = confirmed.current.vote;

          setView({ ...confirmed.current });

          setError(err.message || 'Could not save vote');

          if (err.status === 401) {
            onRequireLogin?.();
          }

          return;
        }

        // Update the server-confirmed state.
        confirmed.current = {
          score: data.score,
          vote: data.userVote,
        };

        // Recalculate the optimistic score using
        // the latest confirmed server response.
        setView({
          vote: desired.current,
          score: confirmed.current.score + (desired.current - confirmed.current.vote),
        });

        onVoteChange?.(data);
      }
    } finally {
      inFlight.current = false;
    }
  };

  const handleClick = (event, clicked) => {
    event.preventDefault();
    event.stopPropagation();

    if (!isAuthenticated) {
      onRequireLogin?.();
      return;
    }

    setError('');

    // Clicking the active arrow removes the vote.
    const next = clicked === desired.current ? 0 : clicked;

    desired.current = next;

    // Update the UI immediately.
    setView({
      vote: next,
      score: confirmed.current.score + (next - confirmed.current.vote),
    });

    void flush();
  };

  const stateClass = view.vote === 1 ? 'vote-pill--up' : view.vote === -1 ? 'vote-pill--down' : '';

  return (
    <div className="vote-wrapper">
      <div className={`vote-pill ${stateClass}`}>
        <button
          type="button"
          className="vote-pill__btn vote-pill__btn--up"
          aria-label="Upvote"
          aria-pressed={view.vote === 1}
          onClick={(e) => handleClick(e, 1)}
        >
          <Arrow filled={view.vote === 1} />
        </button>

        <span className="vote-pill__score" aria-live="polite" title={String(view.score)}>
          {formatScore(view.score)}
        </span>

        <button
          type="button"
          className="vote-pill__btn vote-pill__btn--down"
          aria-label="Downvote"
          aria-pressed={view.vote === -1}
          onClick={(e) => handleClick(e, -1)}
        >
          <Arrow filled={view.vote === -1} down />
        </button>
      </div>

      {error && (
        <span className="vote-pill__error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
