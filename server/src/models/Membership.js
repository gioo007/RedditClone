import mongoose from 'mongoose';

const membershipSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
    },
    community: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Community',
      required: [true, 'Community reference is required'],
    },
    role: {
      type: String,
      enum: ['member', 'moderator'],
      default: 'member',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

membershipSchema.index({ user: 1, community: 1 }, { unique: true });
membershipSchema.index({ community: 1, createdAt: -1 });

export const Membership =
  mongoose.models.Membership || mongoose.model('Membership', membershipSchema);
export default Membership;
