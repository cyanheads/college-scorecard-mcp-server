/**
 * @fileoverview Shared label helpers for formatting Scorecard API integer codes.
 * @module mcp-server/format-helpers
 */

/** Map ownership integer to human-readable label */
export function ownershipLabel(v: number | null | undefined): string {
  if (v == null) return 'Unknown';
  return v === 1 ? 'Public' : v === 2 ? 'Private nonprofit' : v === 3 ? 'For-profit' : String(v);
}

/** Map degree level integer to label */
export function degreeLevelLabel(v: number | null | undefined): string {
  if (v == null) return 'Unknown';
  const map: Record<number, string> = {
    0: 'Non-degree',
    1: 'Certificate',
    2: "Associate's",
    3: "Bachelor's",
    4: 'Graduate',
  };
  return map[v] ?? String(v);
}
