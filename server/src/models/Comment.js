import mongoose from 'mongoose';

export const MAX_COMMENT_DEPTH = 10;

const commentSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: [true, 'Post reference is required'],
      index: true,
    },
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      required: [true, 'Community reference is required'],
      index: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Comment author is required'],
      index: true,
    },
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
      index: true,
    },
    depth: {
      type: Number,
      default: 0,
      min: 0,
      max: [MAX_COMMENT_DEPTH, `Comment nesting depth cannot exceed ${MAX_COMMENT_DEPTH}`],
    },
    content: {
      type: String,
      required: [true, 'Comment content is required'],
      trim: true,
      minlength: [1, 'Comment cannot be empty'],
      maxlength: [10000, 'Comment cannot exceed 10,000 characters'],
    },
    score: {
      type: Number,
      default: 0,
    },
    upvoteCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    downvoteCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    isRemoved: {
      type: Boolean,
      default: false,
    },
    removedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    removedReason: {
      type: String,
      trim: true,
      maxlength: [300, 'Removal reason cannot exceed 300 characters'],
      default: null,
    },
    editedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

commentSchema.index({ post: 1, score: -1, _id: -1 });
commentSchema.index({ post: 1, createdAt: 1, _id: 1 });

export const Comment = mongoose.models.Comment || mongoose.model('Comment', commentSchema);
export default Comment;
