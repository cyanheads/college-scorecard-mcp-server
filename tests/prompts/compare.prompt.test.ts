/**
 * @fileoverview Tests for the compare prompt.
 * @module tests/prompts/compare.prompt.test
 */

import { describe, expect, it } from 'vitest';
import { comparePrompt } from '@/mcp-server/prompts/definitions/compare.prompt.js';

describe('comparePrompt', () => {
  it('generates a valid message array for costs focus', () => {
    const args = comparePrompt.args!.parse({
      school_names: 'University of Washington, University of Oregon',
      focus: 'costs',
    });
    const messages = comparePrompt.generate(args);
    expect(messages).toBeInstanceOf(Array);
    expect(messages.length).toBeGreaterThan(0);
    for (const msg of messages) {
      expect(msg).toHaveProperty('role');
      expect(msg).toHaveProperty('content');
    }
  });

  it('generates a valid message array for outcomes focus', () => {
    const args = comparePrompt.args!.parse({
      school_names: 'MIT, Stanford University',
      focus: 'outcomes',
    });
    const messages = comparePrompt.generate(args);
    expect(messages[0].role).toBe('user');
    const text = (messages[0].content as { type: string; text: string }).text;
    expect(text).toContain('outcomes');
    expect(text).toContain('scorecard_compare_schools');
  });

  it('generates a valid message array for programs focus', () => {
    const args = comparePrompt.args!.parse({
      school_names: 'Carnegie Mellon University, Georgia Tech',
      focus: 'programs',
    });
    const messages = comparePrompt.generate(args);
    const text = (messages[0].content as { type: string; text: string }).text;
    expect(text).toContain('programs');
    expect(text).toContain('scorecard_get_programs');
    expect(text).toContain('scorecard_lookup_cip');
  });

  it('includes school names in the generated message', () => {
    const args = comparePrompt.args!.parse({
      school_names: 'Harvard University, Yale University',
      focus: 'costs',
    });
    const messages = comparePrompt.generate(args);
    const text = (messages[0].content as { type: string; text: string }).text;
    expect(text).toContain('Harvard University');
    expect(text).toContain('Yale University');
  });

  it('includes scorecard_value_analysis for costs and outcomes focus (not programs)', () => {
    for (const focus of ['costs', 'outcomes'] as const) {
      const args = comparePrompt.args!.parse({
        school_names: 'School A, School B',
        focus,
      });
      const messages = comparePrompt.generate(args);
      const text = (messages[0].content as { type: string; text: string }).text;
      expect(text).toContain('scorecard_value_analysis');
    }
  });
});
