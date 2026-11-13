/** Shared operating certification, institution metric scope, and independent price bases. */
import { z } from '@cyanheads/mcp-ts-core';
import type { RawSchoolRecord } from '@/services/scorecard/types.js';

const BasisSchema = z.enum(['academic_year', 'program_year']);

/** Optional current operating certification reported by Scorecard. */
export const OperatingCertificationSchema = z
  .boolean()
  .optional()
  .describe(
    'Current operating certification. False means the institution lacks current certification.',
  );

/** Map the provider flag without assigning a status to unreported values. */
export function operatingCertification(record: RawSchoolRecord | undefined): {
  operating?: boolean;
} {
  const flag = record?.['school.operating'];
  return flag === 0 || flag === 1 ? { operating: flag === 1 } : {};
}

/** Explain explicitly uncertified records in a tool's existing notices. */
export function operatingCertificationNotice(
  schools: { id: number; operating?: boolean | undefined }[],
) {
  const ids = schools.filter((school) => school.operating === false).map((school) => school.id);
  if (ids.length === 0) return;
  return ids.length === 1
    ? `School ${ids[0]} lacks current operating certification according to Scorecard.`
    : `Schools ${ids.join(', ')} lack current operating certification according to Scorecard.`;
}

/** Render the reported flag in text alongside the structured value. */
export function formatOperatingCertification(operating: boolean) {
  return `Operating certification: ${operating ? 'Yes' : 'No'}`;
}

/** Additive institution fields shared by tools and the school resource. */
export const InstitutionContextSchema = z.object({
  ope6_id: z.string().optional().describe('Provider OPEID6 identifier, preserving leading zeros.'),
  metric_scope: z
    .object({
      earnings: z.literal('opeid6').describe('Earnings are OPEID6-pooled.'),
      debt: z.literal('opeid6').describe('Debt is OPEID6-pooled.'),
      repayment: z.literal('opeid6').describe('Repayment is OPEID6-pooled.'),
      completion: z.literal('campus').describe('Completion is campus-specific.'),
    })
    .optional()
    .describe('Earnings, debt and repayment are pooled at OPEID6; completion is campus-specific.'),
});
/** Additive effective prices; academic tuition retains its original in/out-of-state fields. */
export const InstitutionCostsSchema = z.object({
  tuition_program_year: z.number().optional().describe('Reported program-year tuition and fees.'),
  effective_tuition: z
    .number()
    .optional()
    .describe('Available academic-year tuition, otherwise program-year tuition.'),
  tuition_basis: BasisSchema.optional().describe('Period of the effective tuition.'),
  attendance_program_year: z
    .number()
    .optional()
    .describe('Reported program-year cost of attendance.'),
  cost_of_attendance: z
    .number()
    .optional()
    .describe('Available academic-year attendance cost, otherwise program-year cost.'),
  attendance_basis: BasisSchema.optional().describe(
    'Period of the effective attendance cost, selected independently of tuition.',
  ),
});
/** Retain the provider identifier; missing identifiers never imply shared identity. */
export function institutionContext(record: RawSchoolRecord) {
  return {
    ...(record.ope6_id != null && { ope6_id: record.ope6_id }),
    metric_scope: {
      earnings: 'opeid6',
      debt: 'opeid6',
      repayment: 'opeid6',
      completion: 'campus',
    } as const,
  };
}
/** Prefer available academic prices, including zero, independently for each price measure. */
export function institutionCosts(record: RawSchoolRecord) {
  const academicTuition =
    record['latest.cost.tuition.in_state'] ?? record['latest.cost.tuition.out_of_state'];
  const programTuition = record['latest.cost.tuition.program_year'];
  const academicAttendance = record['latest.cost.attendance.academic_year'];
  const programAttendance = record['latest.cost.attendance.program_year'];
  const tuition = academicTuition ?? programTuition;
  const attendance = academicAttendance ?? programAttendance;
  return {
    ...(programTuition != null && { tuition_program_year: programTuition }),
    ...(tuition != null && {
      effective_tuition: tuition,
      tuition_basis:
        academicTuition != null ? ('academic_year' as const) : ('program_year' as const),
    }),
    ...(programAttendance != null && { attendance_program_year: programAttendance }),
    ...(attendance != null && {
      cost_of_attendance: attendance,
      attendance_basis:
        academicAttendance != null ? ('academic_year' as const) : ('program_year' as const),
    }),
  };
}
