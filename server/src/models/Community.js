import mongoose from 'mongoose';

const communityRuleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Rule title is required'],
      trim: true,
      maxlength: [100, 'Rule title cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Rule description cannot exceed 500 characters'],
      default: '',
    },
  },
  { _id: false }
);

const communitySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Community name is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Community name must be at least 3 characters'],
      maxlength: [21, 'Community name cannot exceed 21 characters'],
      match: [
        /^[a-zA-Z0-9_]+$/,
        'Community name may only contain letters, numbers, and underscores',
      ],
    },
    nameLower: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      default() {
        return this.name ? this.name.toLowerCase() : undefined;
      },
    },
    title: {
      type: String,
      trim: true,
      maxlength: [100, 'Community title cannot exceed 100 characters'],
      default() {
        return this.name || '';
      },
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Community description cannot exceed 500 characters'],
      default: '',
    },
    iconUrl: {
      type: String,
      trim: true,
      default: '',
    },
    bannerUrl: {
      type: String,
      trim: true,
      default: '',
    },
    rules: {
      type: [communityRuleSchema],
      default: [],
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Community creator is required'],
      index: true,
    },
    moderators: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default() {
        return this.creator ? [this.creator] : [];
      },
    },
    memberCount: {
      type: Number,
      default: 1,
      min: 0,
    },
    postCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

communitySchema.pre('validate', function syncDerivedFields(next) {
  if (this.name) {
    this.nameLower = this.name.toLowerCase();
    if (!this.title) {
      this.title = this.name;
    }
  }
  if (this.creator && (!this.moderators || this.moderators.length === 0)) {
    this.moderators = [this.creator];
  }
  next();
});

communitySchema.index({ memberCount: -1, _id: -1 });
communitySchema.index({ createdAt: -1, _id: -1 });

export const Community = mongoose.models.Community || mongoose.model('Community', communitySchema);
export default Community;
