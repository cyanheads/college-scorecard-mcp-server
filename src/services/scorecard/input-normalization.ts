/**
 * @fileoverview Shared Scorecard input schemas and normalization at API boundaries.
 * @module services/scorecard/input-normalization
 */

import { z } from '@cyanheads/mcp-ts-core';
import { validationError } from '@cyanheads/mcp-ts-core/errors';
import type { ScorecardSearchOptions } from './types.js';

/** Base-10 ID strings resolving to positive safe integers. */
export const SchoolIdStringSchema = z
  .string()
  .regex(
    /^\s*\+?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?\s*$/,
    'Use a base-10 positive integer school ID from scorecard_search_schools.',
  )
  .refine(
    (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0,
    'Use a positive safe integer school ID from scorecard_search_schools.',
  )
  .describe(
    'Base-10 school ID resolving to a positive safe integer; whitespace, leading zeros, plus, decimal, and exponent forms are accepted.',
  );

/** Identical ID semantics across lookup and comparison tools. */
export const SchoolIdSchema = z
  .union([
    SchoolIdStringSchema,
    z
      .number()
      .int()
      .positive()
      .max(Number.MAX_SAFE_INTEGER)
      .describe('Positive safe integer school ID.'),
  ])
  .describe('School ID from scorecard_search_schools.');

/** Optional text values sent by form clients are unset when blank. */
export const meaningfulText = (value: string | undefined): string | undefined =>
  value?.trim() || undefined;

/** Validate required IDs before an API request can lose its identifying filter. */
export function normalizeSchoolId(value: string | number): number {
  if (!SchoolIdSchema.safeParse(value).success) {
    throw validationError('Use a positive safe integer school ID from scorecard_search_schools.', {
      reason: 'api_validation',
      recovery: { hint: 'Discover a valid school ID using scorecard_search_schools and retry.' },
    });
  }
  return Number(value);
}

/** Four-digit CIP selector, normalized to the provider's undotted representation. */
export function normalizeCip(value: string | undefined): string | undefined {
  const text = meaningfulText(value);
  if (!text) return undefined;
  if (!/^\d{2}\.?\d{2}$/.test(text))
    throw validationError('Use a four-digit CIP code, such as 11.07 or 1107.', {
      reason: 'api_validation',
    });
  return text.replace('.', '');
}

/** Normalize supported state lists without restricting them to known records. */
export function normalizeState(value: string | undefined): string | undefined {
  const text = meaningfulText(value);
  if (!text) return undefined;
  const tokens = text.split(',').map((token) => token.trim().toUpperCase());
  if (tokens.some((token) => !/^[A-Z]{2}$/.test(token)))
    throw validationError('Use two-letter state codes separated by commas, such as WA,CA.', {
      reason: 'api_validation',
    });
  return [...new Set(tokens)].join(',');
}

/** Normalize school-side selectors before forwarding or echoing them. */
export function normalizeSearchOptions(options: ScorecardSearchOptions): ScorecardSearchOptions {
  const zip = meaningfulText(options.zip);
  const distance = meaningfulText(options.distance)?.toLowerCase();
  let sort = meaningfulText(options.sort);
  if (zip && !/^\d{5}(?:-\d{4})?$/.test(zip))
    throw validationError('Use a five-digit ZIP or ZIP+4 code.', { reason: 'api_validation' });
  if (distance && !zip)
    throw validationError(
      'A distance filter requires a ZIP code; provide zip or remove distance.',
      { reason: 'api_validation' },
    );
  if (distance && !/^(?:\d+(?:\.\d+)?|\.\d+)(?:mi|km)?$/.test(distance))
    throw validationError(
      'Use a nonnegative radius in miles or kilometers, such as 5, 5.5mi, or 5km.',
      { reason: 'api_validation' },
    );
  if (sort) {
    const match = /^([\w.-]+)(?::(asc|desc))?$/i.exec(sort);
    if (!match)
      throw validationError(
        'Use one indexed field with optional :asc or :desc; multiple sort fields are unsupported.',
        { reason: 'api_validation' },
      );
    sort = `${match[1]}${match[2] ? `:${match[2].toLowerCase()}` : ''}`;
  }
  const range = (value: [number, number] | undefined): [number, number] | undefined =>
    value && [Math.min(...value), Math.max(...value)];
  return {
    ...options,
    name: meaningfulText(options.name),
    state: normalizeState(options.state),
    cipCode: normalizeCip(options.cipCode),
    zip,
    distance,
    sort,
    sizeRange: range(options.sizeRange),
    acceptanceRateRange: range(options.acceptanceRateRange),
    perPage: options.perPage ?? 20,
    page: options.page ?? 0,
  };
}
