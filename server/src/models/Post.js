import mongoose from 'mongoose';

const aiSummarySchema = new mongoose.Schema(
  {
    text: { type: String, default: null },
    generatedAt: { type: Date, default: null },
    model: { type: String, default: null },
  },
  { _id: false }
);

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Post title is required'],
      trim: true,
      minlength: [1, 'Post title cannot be empty'],
      maxlength: [300, 'Post title cannot exceed 300 characters'],
    },
    type: {
      type: String,
      enum: {
        values: ['text', 'link', 'image'],
        message: 'Post type must be text, link, or image',
      },
      default: 'text',
      required: true,
    },
    content: {
      type: String,
      default: '',
      maxlength: [40000, 'Post content cannot exceed 40,000 characters'],
    },
    linkUrl: {
      type: String,
      trim: true,
      default: '',
      validate: {
        validator(val) {
          return this.type !== 'link' || Boolean(val && val.trim());
        },
        message: 'linkUrl is required when post type is link',
      },
    },
    imageUrl: {
      type: String,
      trim: true,
      default: '',
      validate: {
        validator(val) {
          return this.type !== 'image' || Boolean(val && val.trim());
        },
        message: 'imageUrl is required when post type is image',
      },
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Post author is required'],
      index: true,
    },
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      required: [true, 'Target community is required'],
      index: true,
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
    commentCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    aiSummary: {
      type: aiSummarySchema,
      default: null,
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

postSchema.index({ community: 1, createdAt: -1, _id: -1 });
postSchema.index({ community: 1, score: -1, _id: -1 });
postSchema.index({ createdAt: -1, _id: -1 });
postSchema.index({ score: -1, _id: -1 });

export const Post = mongoose.models.Post || mongoose.model('Post', postSchema);
export default Post;
