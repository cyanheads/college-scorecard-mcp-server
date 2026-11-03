/**
 * @fileoverview Bundle pruning keeps SDK runtime modules named skills.
 * @module tests/scripts/bundle-runtime.test
 */

import { describe, expect, it } from 'vitest';
import { filterAgentDocEntries } from '../../scripts/clean-mcpb.js';
import { AGENT_DOC_ENTRY } from '../../scripts/lint-packaging.js';

describe('bundle agent documentation pruning', () => {
  it('strips package-root documentation while preserving SDK skills runtime', () => {
    const docs = [
      'node_modules/example/skills/search/SKILL.md',
      'node_modules/@cyanheads/mcp-ts-core/framework-skills/add-tool/SKILL.md',
      'node_modules/parent/node_modules/@scope/child/.agents/guide.md',
      'node_modules/@scope/parent/node_modules/child/skills/search/reference.md',
    ];
    const runtime = [
      'node_modules/@modelcontextprotocol/server/dist/ext/skills/index.js',
      'node_modules/@modelcontextprotocol/server/dist/ext/skills/loader.js',
      'node_modules/parent/node_modules/@scope/child/dist/skills/index.js',
      'skills/search/SKILL.md',
    ];
    expect(filterAgentDocEntries([...docs, ...runtime])).toEqual(docs);
    expect([...docs, ...runtime].filter((entry) => AGENT_DOC_ENTRY.test(entry))).toEqual(docs);
  });
});
