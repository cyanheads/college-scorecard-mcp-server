/**
 * @fileoverview Domain types for College Scorecard API responses.
 * @module services/scorecard/types
 */

/** Nested program object returned under `latest.programs.cip_4_digit` */
export interface RawProgram {
  code?: string;
  counts?: {
    ipeds_enrollment?: number | null;
  };
  credential?: { level?: number | null; title?: string | null };
  debt?: {
    median_debt?: number | null;
  };
  earnings?: {
    highest?: {
      '1_yr'?: {
        overall_median_earnings?: number | null;
        overall_count_titleiv?: number | null;
      };
    };
  };
  title?: string;
}

/** Raw school record from the Scorecard API (fields vary by query). */
export interface RawSchoolRecord {
  id?: number;
  'latest.admissions.act_scores.25th_percentile.cumulative'?: number | null;
  'latest.admissions.act_scores.75th_percentile.cumulative'?: number | null;
  // Admissions
  'latest.admissions.admission_rate.overall'?: number | null;
  'latest.admissions.sat_scores.25th_percentile.critical_reading'?: number | null;
  'latest.admissions.sat_scores.25th_percentile.math'?: number | null;
  'latest.admissions.sat_scores.75th_percentile.critical_reading'?: number | null;
  'latest.admissions.sat_scores.75th_percentile.math'?: number | null;
  'latest.admissions.sat_scores.average.overall'?: number | null;
  'latest.aid.federal_loan_rate'?: number | null;
  // Aid
  'latest.aid.median_debt.completers.overall'?: number | null;
  'latest.aid.pell_grant_rate'?: number | null;
  // Completion
  'latest.completion.rate_suppressed.overall'?: number | null;
  'latest.cost.attendance.academic_year'?: number | null;
  'latest.cost.avg_net_price.by_income.0-30000'?: number | null;
  'latest.cost.avg_net_price.by_income.30001-48000'?: number | null;
  'latest.cost.avg_net_price.by_income.48001-75000'?: number | null;
  'latest.cost.avg_net_price.by_income.75001-110000'?: number | null;
  'latest.cost.avg_net_price.by_income.110001-plus'?: number | null;
  'latest.cost.avg_net_price.overall'?: number | null;
  // Cost
  'latest.cost.tuition.in_state'?: number | null;
  'latest.cost.tuition.out_of_state'?: number | null;
  'latest.earnings.6_yrs_after_entry.female_students.median_earnings'?: number | null;
  'latest.earnings.6_yrs_after_entry.male_students.median_earnings'?: number | null;
  // Earnings
  'latest.earnings.6_yrs_after_entry.median'?: number | null;
  'latest.earnings.6_yrs_after_entry.percentile25'?: number | null;
  'latest.earnings.6_yrs_after_entry.percentile75'?: number | null;
  'latest.earnings.8_yrs_after_entry.median_earnings'?: number | null;
  'latest.earnings.10_yrs_after_entry.median'?: number | null;
  'latest.earnings.10_yrs_after_entry.percentile25'?: number | null;
  'latest.earnings.10_yrs_after_entry.percentile75'?: number | null;
  // Programs nested array
  'latest.programs.cip_4_digit'?: RawProgram[];
  'latest.repayment.3_yr_repayment.overall'?: number | null;
  'latest.student.size'?: number | null;
  'school.carnegie_basic'?: number | null;
  'school.city'?: string;
  'school.degrees_awarded.predominant'?: number | null;
  'school.hbcu'?: number | null;
  'school.institutional_characteristics.level'?: number | null;
  'school.locale'?: number | null;
  'school.men_only'?: number | null;
  'school.name'?: string;
  'school.ownership'?: number | null;
  'school.school_url'?: string;
  'school.state'?: string;
  'school.women_only'?: number | null;
  'school.zip'?: string;
  // Allow additional dynamic fields
  [key: string]: unknown;
}

/** Raw API response envelope */
export interface ScorecardApiResponse {
  metadata: {
    total: number;
    page: number;
    per_page: number;
  };
  results: RawSchoolRecord[];
}

/** Error shape returned by the Scorecard API */
export interface ScorecardApiError {
  error?: {
    code?: string;
    message?: string;
  };
  errors?: Array<{
    error?: string;
    input?: string;
    message?: string;
  }>;
}

/** Options for a search query */
export interface ScorecardSearchOptions {
  /** Acceptance rate range [min, max] 0-1 */
  acceptanceRateRange?: [number, number];
  /** CIP code filter */
  cipCode?: string;
  /** Predominant degree level: 0-4 */
  degreeLevel?: number;
  /** Distance from zip (e.g. "50mi") */
  distance?: string;
  /** Additional query params */
  extraParams?: Record<string, string | number>;
  /** Custom field selection (comma-separated) */
  fields?: string;
  /** School unit ID(s) for batch lookup */
  id?: string | number | Array<string | number>;
  /** School name full-text filter */
  name?: string;
  /** Ownership type: 1=public, 2=private nonprofit, 3=for-profit */
  ownership?: number;
  page?: number;
  perPage?: number;
  /** Enrollment size range [min, max] */
  sizeRange?: [number, number];
  /** Sort expression (e.g. "latest.cost.tuition.in_state:asc") */
  sort?: string;
  /** Two-letter state code */
  state?: string;
  /** US zip code for geographic filter */
  zip?: string;
}
