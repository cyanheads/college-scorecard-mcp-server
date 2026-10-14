/**
 * @fileoverview Availability classification for provider metrics without inferred causes.
 * @module services/scorecard/metric-availability
 */

import { z } from '@cyanheads/mcp-ts-core';
import { serviceUnavailable } from '@cyanheads/mcp-ts-core/errors';

/** Known states of a returned provider metric. */
export const MetricAvailabilitySchema = z.enum(['available', 'unavailable', 'privacy_suppressed']);

/** Preserve numbers, distinguish explicit privacy sentinels, and reject unknown shapes. */
export function readMetric(raw: unknown): {
  availability: z.infer<typeof MetricAvailabilitySchema>;
  value?: number;
} {
  if (typeof raw === 'number' && Number.isFinite(raw))
    return { availability: 'available', value: raw };
  if (raw == null) return { availability: 'unavailable' };
  if (raw === 'PS' || raw === 'PrivacySuppressed') return { availability: 'privacy_suppressed' };
  throw serviceUnavailable(
    'Unexpected provider metric value; expected a number, null, or explicit privacy marker.',
    { reason: 'api_error' },
  );
}
