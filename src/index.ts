#!/usr/bin/env node
/**
 * @fileoverview college-scorecard-mcp-server MCP server entry point.
 * @module index
 */

import { createApp } from '@cyanheads/mcp-ts-core';
// Prompts
import { comparePrompt } from './mcp-server/prompts/definitions/compare.prompt.js';
import { programsResource } from './mcp-server/resources/definitions/programs.resource.js';
import { programsPageResource } from './mcp-server/resources/definitions/programs-page.resource.js';
// Resources
import { schoolResource } from './mcp-server/resources/definitions/school.resource.js';
import { compareSchoolsTool } from './mcp-server/tools/definitions/compare-schools.tool.js';
import { getEarningsTool } from './mcp-server/tools/definitions/get-earnings.tool.js';
import { getProgramsTool } from './mcp-server/tools/definitions/get-programs.tool.js';
import { getSchoolTool } from './mcp-server/tools/definitions/get-school.tool.js';
import { listFieldsTool } from './mcp-server/tools/definitions/list-fields.tool.js';
// Tools
import { lookupCipTool } from './mcp-server/tools/definitions/lookup-cip.tool.js';
import { searchProgramsTool } from './mcp-server/tools/definitions/search-programs.tool.js';
import { searchSchoolsTool } from './mcp-server/tools/definitions/search-schools.tool.js';
import { valueAnalysisTool } from './mcp-server/tools/definitions/value-analysis.tool.js';
import { initScorecardService } from './services/scorecard/scorecard-service.js';

await createApp({
  name: 'college-scorecard-mcp-server',
  title: 'college-scorecard-mcp-server',
  tools: [
    lookupCipTool,
    listFieldsTool,
    searchSchoolsTool,
    getSchoolTool,
    getProgramsTool,
    getEarningsTool,
    searchProgramsTool,
    compareSchoolsTool,
    valueAnalysisTool,
  ],
  resources: [schoolResource, programsResource, programsPageResource],
  prompts: [comparePrompt],
  instructions:
    'Resolve institution names to unit IDs with scorecard_search_schools and program names to CIP codes with scorecard_lookup_cip before retrieving or comparing outcomes. Program tools distinguish completion-based 1/4-year earnings from legacy highest-credential earnings; scorecard_get_earnings reports institution entrant outcomes at 6/8/10 years. Follow program-row and school-page continuations separately before drawing coverage or ranking conclusions. Check reported populations, dollar years, OPEID6 pooling, and price bases before comparing values. scorecard_lookup_cip and scorecard_list_fields use embedded reference data without API calls.',
  sessionMode: 'stateless',
  skills: 'skills',
  setup(core) {
    initScorecardService(core.config, core.storage);
  },
});
