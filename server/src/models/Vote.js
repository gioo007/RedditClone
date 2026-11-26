import mongoose from 'mongoose';

/**
 * Polymorphic vote document supporting both Post and Comment targets.
 * The unique compound index on `(user, targetType, targetId)` guarantees at the database
 * level that a user can hold at most one vote per post (and one vote per comment).
 * Removing a vote (`value: 0` at the API boundary) deletes the corresponding Vote document.
 */
const voteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Voting user is required'],
    },
    targetType: {
      type: String,
      enum: {
        values: ['Post', 'Comment'],
        message: 'Vote targetType must be Post or Comment',
      },
      default: 'Post',
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Vote targetId is required'],
      refPath: 'targetType',
    },
    value: {
      type: Number,
      enum: {
        values: [1, -1],
        message: 'Stored vote value must be 1 (upvote) or -1 (downvote)',
      },
      required: [true, 'Vote value is required'],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

voteSchema.index({ user: 1, targetType: 1, targetId: 1 }, { unique: true });
voteSchema.index({ targetType: 1, targetId: 1 });

export const Vote = mongoose.models.Vote || mongoose.model('Vote', voteSchema);
export default Vote;
