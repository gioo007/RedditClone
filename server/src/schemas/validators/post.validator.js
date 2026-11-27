import { idParamSchema, z } from '../middleware/validate.js';

export const postIdParamSchema = idParamSchema;

export const safeHttpUrl = z
  .string()
  .trim()
  .url('Must be a valid URL')
  .refine((val) => /^https?:\/\//i.test(val), {
    message: 'URL must use http:// or https://',
  });

export const communityNameParamSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Community name must be at least 3 characters')
    .max(21, 'Community name cannot exceed 21 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Community name may only contain letters, numbers, and underscores'),
});

export const createPostBodySchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Post title is required')
      .max(300, 'Post title cannot exceed 300 characters'),
    type: z.enum(['text', 'link', 'image']).default('text'),
    content: z
      .string()
      .max(40000, 'Post content cannot exceed 40,000 characters')
      .optional()
      .default(''),
    linkUrl: z
      .union([safeHttpUrl, z.literal('')])
      .optional()
      .default(''),
    imageUrl: z
      .union([safeHttpUrl, z.literal('')])
      .optional()
      .default(''),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'link' && !data.linkUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['linkUrl'],
        message: 'linkUrl is required when post type is link',
      });
    }

    if (data.type === 'image' && !data.imageUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['imageUrl'],
        message: 'imageUrl is required when post type is image',
      });
    }
  });

export const updatePostBodySchema = z
  .object({
    content: z.string().max(40000, 'Post content cannot exceed 40,000 characters').optional(),
    linkUrl: safeHttpUrl.optional(),
    imageUrl: safeHttpUrl.optional(),
  })
  .refine(
    (data) =>
      data.content !== undefined || data.linkUrl !== undefined || data.imageUrl !== undefined,
    {
      message: 'At least one editable field (content, linkUrl, or imageUrl) must be provided',
    }
  );

export const removePostBodySchema = z.object({
  reason: z.string().trim().max(300, 'Removal reason cannot exceed 300 characters').optional(),
});
