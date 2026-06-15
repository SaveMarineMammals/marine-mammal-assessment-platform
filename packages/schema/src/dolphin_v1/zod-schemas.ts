import { z } from 'zod';
import { isSemver, isUtcDateTime } from '../common/primitives.js';
import { locationSchema } from '../manatee_v1/zod-schemas.js';

export const DOLPHIN_V1_PROTOCOL = 'dolphin_v1' as const;
export const DOLPHIN_V1_VERSION = '0.1.0' as const;

export const DOLPHIN_MEASUREMENT_TYPES = ['body_condition', 'respiratory_rate'] as const;

export const DOLPHIN_CANONICAL_UNITS = {
  body_condition: 'score',
  respiratory_rate: 'breaths/min',
} as const;

const utcDateTimeSchema = z
  .string()
  .refine(isUtcDateTime, 'Must be ISO 8601 UTC (Z suffix or +00:00 offset)');

const semverSchema = z.string().refine(isSemver, 'Must be a valid semantic version');

const uuidSchema = z.string().uuid();

const assessmentBaseSchema = z
  .object({
    id: uuidSchema,
    name: z.string().min(1),
    assessment_started_at: utcDateTimeSchema,
    assessment_ended_at: utcDateTimeSchema.optional(),
    location: locationSchema,
    assessment_type: z.literal(DOLPHIN_V1_PROTOCOL),
    protocol_version: semverSchema,
    collector_id: uuidSchema,
    notes: z.string().optional(),
    created_at: utcDateTimeSchema.optional(),
    updated_at: utcDateTimeSchema.optional(),
    sync_status: z.enum(['local-only', 'pending', 'synced', 'error']).optional(),
  })
  .strict();

export const dolphinAssessmentDraftSchema = assessmentBaseSchema;

export const dolphinAssessmentCompleteSchema = assessmentBaseSchema.extend({
  assessment_ended_at: utcDateTimeSchema,
});

const measurementCommonSchema = {
  id: uuidSchema,
  assessment_id: uuidSchema,
  recorded_at: utcDateTimeSchema,
  notes: z.string().nullable().optional(),
  sequence: z.number().int().min(1).optional(),
};

export const dolphinMeasurementSchema = z.discriminatedUnion('measurement_type', [
  z
    .object({
      ...measurementCommonSchema,
      measurement_type: z.literal('body_condition'),
      value: z.number().int().min(1).max(5),
      unit: z.literal(DOLPHIN_CANONICAL_UNITS.body_condition),
    })
    .strict(),
  z
    .object({
      ...measurementCommonSchema,
      measurement_type: z.literal('respiratory_rate'),
      value: z.number().positive(),
      unit: z.literal(DOLPHIN_CANONICAL_UNITS.respiratory_rate),
    })
    .strict(),
]);

export type DolphinAssessmentDraft = z.infer<typeof dolphinAssessmentDraftSchema>;
export type DolphinAssessmentComplete = z.infer<typeof dolphinAssessmentCompleteSchema>;
export type DolphinMeasurement = z.infer<typeof dolphinMeasurementSchema>;
export type DolphinMeasurementType = DolphinMeasurement['measurement_type'];
