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
    'College Scorecard MCP Server — U.S. higher education data from the Department of Education.\n' +
    '- Start with scorecard_search_schools to find institutions by name, state, or type\n' +
    '- Use scorecard_lookup_cip to convert program names to CIP codes before filtering by program\n' +
    '- scorecard_get_programs returns program-level 1-year earnings (not institution-level)\n' +
    '- scorecard_value_analysis computes debt-to-earnings and ROI metrics in one call\n' +
    '- scorecard_list_fields and scorecard_lookup_cip make zero API calls — safe to use freely',
  setup(core) {
    initScorecardService(core.config, core.storage);
  },
});
