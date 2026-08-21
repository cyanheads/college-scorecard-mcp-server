/**
 * @fileoverview Representative school unit IDs advertised through resources/list.
 * Every entry is a real unit ID verified against the live College Scorecard API;
 * the full institution space is discoverable via scorecard_search_schools.
 * @module mcp-server/resources/definitions/example-schools
 */

export interface ExampleSchool {
  /** IPEDS UNITID used by the College Scorecard API. */
  id: number;
  name: string;
}

export const EXAMPLE_SCHOOLS: readonly ExampleSchool[] = [
  { id: 130794, name: 'Yale University' },
  { id: 166027, name: 'Harvard University' },
  { id: 166683, name: 'Massachusetts Institute of Technology' },
  { id: 236948, name: 'University of Washington-Seattle Campus' },
  { id: 243744, name: 'Stanford University' },
];
