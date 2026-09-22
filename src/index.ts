#!/usr/bin/env node
/**
 * @fileoverview college-scorecard-mcp-server MCP server entry point.
 * @module index
 */

import { createApp } from '@cyanheads/mcp-ts-core';
// Prompts
import { comparePrompt } from './mcp-server/prompts/definitions/compare.prompt.js';
import { programsResource } from './mcp-server/resources/definitions/programs.resource.js';
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
  resources: [schoolResource, programsResource],
  prompts: [comparePrompt],
  instructions:
    'Find U.S. institutions with scorecard_search_schools, then pass the returned unit IDs to scorecard_get_school, scorecard_get_earnings, scorecard_get_programs, scorecard_compare_schools, or scorecard_value_analysis, which computes debt-to-earnings and ROI metrics in one call. To filter by field of study, resolve the program name to a CIP code with scorecard_lookup_cip first; program-level 1-year earnings come from scorecard_get_programs and scorecard_search_programs, institution-level 6/8/10-year earnings from scorecard_get_earnings. scorecard_lookup_cip and scorecard_list_fields read embedded data and make no API calls, so they are safe to use freely.',
  sessionMode: 'stateless',
  setup(core) {
    initScorecardService(core.config, core.storage);
  },
});
