import { z } from 'zod';
import { isSemver, isUtcDateTime } from '../common/primitives.js';

export const MANATEE_V1_PROTOCOL = 'manatee_v1' as const;
export const MANATEE_V1_VERSION = '1.0.0' as const;

export const MEASUREMENT_TYPES = [
  'length',
  'weight',
  'internal_temperature',
  'external_temperature',
  'blood_pressure',
  'heart_rate',
  'respiratory_rate',
] as const;

export const SYNC_STATUSES = ['local-only', 'pending', 'synced', 'error'] as const;

export const CANONICAL_UNITS = {
  length: 'cm',
  weight: 'kg',
  internal_temperature: '°C',
  external_temperature: '°C',
  blood_pressure: 'mmHg',
  heart_rate: 'bpm',
  respiratory_rate: 'breaths/min',
} as const;

const utcDateTimeSchema = z
  .string()
  .refine(isUtcDateTime, 'Must be ISO 8601 UTC (Z suffix or +00:00 offset)');

const semverSchema = z.string().refine(isSemver, 'Must be a valid semantic version');

const uuidSchema = z.string().uuid();

export const locationSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy_meters: z.number().positive().optional(),
    altitude: z.number().optional(),
    capture_method_note: z.string().optional(),
  })
  .strict();

const assessmentBaseSchema = z
  .object({
    id: uuidSchema,
    name: z.string().min(1),
    assessment_started_at: utcDateTimeSchema,
    assessment_ended_at: utcDateTimeSchema.optional(),
    location: locationSchema,
    assessment_type: z.literal(MANATEE_V1_PROTOCOL),
    protocol_version: semverSchema,
    collector_id: uuidSchema,
    organization: z.string().min(1).optional(),
    campaign: z.string().min(1).optional(),
    notes: z.string().optional(),
    created_at: utcDateTimeSchema.optional(),
    updated_at: utcDateTimeSchema.optional(),
    sync_status: z.enum(SYNC_STATUSES).optional(),
  })
  .strict();

export const manateeAssessmentDraftSchema = assessmentBaseSchema;

export const manateeAssessmentCompleteSchema = assessmentBaseSchema.extend({
  assessment_ended_at: utcDateTimeSchema,
});

const measurementCommonSchema = {
  id: uuidSchema,
  assessment_id: uuidSchema,
  recorded_at: utcDateTimeSchema,
  method: z.string().optional(),
  notes: z.string().nullable().optional(),
  sequence: z.number().int().min(1).optional(),
};

export const manateeMeasurementSchema = z.discriminatedUnion('measurement_type', [
  z
    .object({
      ...measurementCommonSchema,
      measurement_type: z.literal('length'),
      value: z.number().positive(),
      unit: z.literal(CANONICAL_UNITS.length),
    })
    .strict(),
  z
    .object({
      ...measurementCommonSchema,
      measurement_type: z.literal('weight'),
      value: z.number().positive(),
      unit: z.literal(CANONICAL_UNITS.weight),
    })
    .strict(),
  z
    .object({
      ...measurementCommonSchema,
      measurement_type: z.literal('internal_temperature'),
      value: z.number(),
      unit: z.literal(CANONICAL_UNITS.internal_temperature),
    })
    .strict(),
  z
    .object({
      ...measurementCommonSchema,
      measurement_type: z.literal('external_temperature'),
      value: z.number(),
      unit: z.literal(CANONICAL_UNITS.external_temperature),
    })
    .strict(),
  z
    .object({
      ...measurementCommonSchema,
      measurement_type: z.literal('blood_pressure'),
      value: z
        .object({
          systolic: z.number().positive(),
          diastolic: z.number().positive(),
        })
        .strict(),
      unit: z.literal(CANONICAL_UNITS.blood_pressure),
    })
    .strict(),
  z
    .object({
      ...measurementCommonSchema,
      measurement_type: z.literal('heart_rate'),
      value: z.number().int().positive(),
      unit: z.literal(CANONICAL_UNITS.heart_rate),
    })
    .strict(),
  z
    .object({
      ...measurementCommonSchema,
      measurement_type: z.literal('respiratory_rate'),
      value: z.number().int().positive(),
      unit: z.literal(CANONICAL_UNITS.respiratory_rate),
    })
    .strict(),
]);

export type ManateeAssessmentDraft = z.infer<typeof manateeAssessmentDraftSchema>;
export type ManateeAssessmentComplete = z.infer<typeof manateeAssessmentCompleteSchema>;
export type ManateeMeasurement = z.infer<typeof manateeMeasurementSchema>;
export type ManateeLocation = z.infer<typeof locationSchema>;
export type MeasurementType = ManateeMeasurement['measurement_type'];
