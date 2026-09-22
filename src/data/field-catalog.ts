/**
 * @fileoverview Embedded College Scorecard field catalog. Derived from the
 * Scorecard data dictionary. Static data — no API call required.
 * @module data/field-catalog
 */

export interface FieldEntry {
  /** Thematic category */
  category: string;
  /** Human-readable description */
  description: string;
  /** API field path (e.g. "latest.cost.tuition.in_state") */
  path: string;
  /** Whether this field supports API-side sorting */
  sortable: boolean;
  /** Data type */
  type: 'integer' | 'float' | 'string' | 'boolean';
}

/** Core field catalog — most decision-relevant fields from the data dictionary. */
export const FIELD_CATALOG: FieldEntry[] = [
  // Identity
  {
    path: 'id',
    description: 'Unique unit ID (use for ID-based lookups)',
    type: 'integer',
    sortable: true,
    category: 'identity',
  },
  {
    path: 'school.name',
    description: 'Institution name',
    type: 'string',
    sortable: true,
    category: 'identity',
  },
  {
    path: 'school.city',
    description: 'City',
    type: 'string',
    sortable: false,
    category: 'identity',
  },
  {
    path: 'school.state',
    description: 'State (two-letter code)',
    type: 'string',
    sortable: false,
    category: 'identity',
  },
  {
    path: 'school.zip',
    description: 'ZIP code',
    type: 'string',
    sortable: false,
    category: 'identity',
  },
  {
    path: 'school.school_url',
    description: 'Institution website URL',
    type: 'string',
    sortable: false,
    category: 'identity',
  },
  {
    path: 'school.ownership',
    description: 'Control: 1=public, 2=private nonprofit, 3=private for-profit',
    type: 'integer',
    sortable: false,
    category: 'identity',
  },
  {
    path: 'school.carnegie_basic',
    description: 'Carnegie Basic Classification',
    type: 'integer',
    sortable: false,
    category: 'identity',
  },
  {
    path: 'school.locale',
    description:
      'Urbanization: 11=city-large, 12=city-mid, 13=city-small, 21=suburb-large, 31=town-fringe, 41=rural-fringe',
    type: 'integer',
    sortable: false,
    category: 'identity',
  },
  {
    path: 'school.degrees_awarded.predominant',
    description:
      'Predominant degree: 0=non-degree, 1=certificate, 2=associate, 3=bachelor, 4=graduate',
    type: 'integer',
    sortable: false,
    category: 'identity',
  },
  {
    path: 'school.institutional_characteristics.level',
    description: 'Level: 1=4-year, 2=2-year, 3=less-than-2-year',
    type: 'integer',
    sortable: false,
    category: 'identity',
  },
  {
    path: 'school.religious_affiliation',
    description: 'Religious affiliation code (0=none)',
    type: 'integer',
    sortable: false,
    category: 'identity',
  },
  {
    path: 'school.hbcu',
    description: 'Historically Black College or University flag',
    type: 'integer',
    sortable: false,
    category: 'identity',
  },
  {
    path: 'school.men_only',
    description: 'Men-only institution flag',
    type: 'integer',
    sortable: false,
    category: 'identity',
  },
  {
    path: 'school.women_only',
    description: 'Women-only institution flag',
    type: 'integer',
    sortable: false,
    category: 'identity',
  },

  // Cost
  {
    path: 'latest.cost.tuition.in_state',
    description: 'In-state tuition and fees (list price)',
    type: 'integer',
    sortable: true,
    category: 'cost',
  },
  {
    path: 'latest.cost.tuition.out_of_state',
    description: 'Out-of-state tuition and fees (list price)',
    type: 'integer',
    sortable: true,
    category: 'cost',
  },
  {
    path: 'latest.cost.avg_net_price.overall',
    description: 'Average net price (all students receiving Title IV aid)',
    type: 'integer',
    sortable: true,
    category: 'cost',
  },
  {
    path: 'latest.cost.net_price.public.by_income_level.0-30000',
    description: 'Net price for family income $0–$30,000 (public institutions)',
    type: 'integer',
    sortable: false,
    category: 'cost',
  },
  {
    path: 'latest.cost.net_price.public.by_income_level.30001-48000',
    description: 'Net price for family income $30,001–$48,000 (public institutions)',
    type: 'integer',
    sortable: false,
    category: 'cost',
  },
  {
    path: 'latest.cost.net_price.public.by_income_level.48001-75000',
    description: 'Net price for family income $48,001–$75,000 (public institutions)',
    type: 'integer',
    sortable: false,
    category: 'cost',
  },
  {
    path: 'latest.cost.net_price.public.by_income_level.75001-110000',
    description: 'Net price for family income $75,001–$110,000 (public institutions)',
    type: 'integer',
    sortable: false,
    category: 'cost',
  },
  {
    path: 'latest.cost.net_price.public.by_income_level.110001-plus',
    description: 'Net price for family income $110,001+ (public institutions)',
    type: 'integer',
    sortable: false,
    category: 'cost',
  },
  {
    path: 'latest.cost.net_price.private.by_income_level.0-30000',
    description: 'Net price for family income $0–$30,000 (private institutions)',
    type: 'integer',
    sortable: false,
    category: 'cost',
  },
  {
    path: 'latest.cost.net_price.private.by_income_level.30001-48000',
    description: 'Net price for family income $30,001–$48,000 (private institutions)',
    type: 'integer',
    sortable: false,
    category: 'cost',
  },
  {
    path: 'latest.cost.net_price.private.by_income_level.48001-75000',
    description: 'Net price for family income $48,001–$75,000 (private institutions)',
    type: 'integer',
    sortable: false,
    category: 'cost',
  },
  {
    path: 'latest.cost.net_price.private.by_income_level.75001-110000',
    description: 'Net price for family income $75,001–$110,000 (private institutions)',
    type: 'integer',
    sortable: false,
    category: 'cost',
  },
  {
    path: 'latest.cost.net_price.private.by_income_level.110001-plus',
    description: 'Net price for family income $110,001+ (private institutions)',
    type: 'integer',
    sortable: false,
    category: 'cost',
  },
  {
    path: 'latest.cost.attendance.academic_year',
    description: 'Total cost of attendance per academic year',
    type: 'integer',
    sortable: true,
    category: 'cost',
  },
  {
    path: 'latest.cost.attendance.program_year',
    description: 'Total cost of attendance per program year',
    type: 'integer',
    sortable: false,
    category: 'cost',
  },
  {
    path: 'latest.cost.roomboard.oncampus',
    description: 'On-campus room and board cost',
    type: 'integer',
    sortable: false,
    category: 'cost',
  },
  {
    path: 'latest.cost.booksupply',
    description: 'Books and supplies cost',
    type: 'integer',
    sortable: false,
    category: 'cost',
  },

  // Admissions
  {
    path: 'latest.admissions.admission_rate.overall',
    description: 'Overall admission rate (0–1)',
    type: 'float',
    sortable: true,
    category: 'admissions',
  },
  {
    path: 'latest.admissions.sat_scores.average.overall',
    description: 'Average SAT score (all sections)',
    type: 'integer',
    sortable: true,
    category: 'admissions',
  },
  {
    path: 'latest.admissions.sat_scores.25th_percentile.critical_reading',
    description: 'SAT Critical Reading 25th percentile',
    type: 'integer',
    sortable: false,
    category: 'admissions',
  },
  {
    path: 'latest.admissions.sat_scores.75th_percentile.critical_reading',
    description: 'SAT Critical Reading 75th percentile',
    type: 'integer',
    sortable: false,
    category: 'admissions',
  },
  {
    path: 'latest.admissions.sat_scores.25th_percentile.math',
    description: 'SAT Math 25th percentile',
    type: 'integer',
    sortable: false,
    category: 'admissions',
  },
  {
    path: 'latest.admissions.sat_scores.75th_percentile.math',
    description: 'SAT Math 75th percentile',
    type: 'integer',
    sortable: false,
    category: 'admissions',
  },
  {
    path: 'latest.admissions.act_scores.25th_percentile.cumulative',
    description: 'ACT composite 25th percentile',
    type: 'integer',
    sortable: false,
    category: 'admissions',
  },
  {
    path: 'latest.admissions.act_scores.75th_percentile.cumulative',
    description: 'ACT composite 75th percentile',
    type: 'integer',
    sortable: false,
    category: 'admissions',
  },
  {
    path: 'latest.student.size',
    description: 'Total undergraduate enrollment',
    type: 'integer',
    sortable: true,
    category: 'admissions',
  },

  // Financial Aid
  {
    path: 'latest.aid.loan_principal',
    description: 'Median loan principal (institutional level)',
    type: 'integer',
    sortable: true,
    category: 'aid',
  },
  {
    path: 'latest.aid.median_debt.completers.overall',
    description: 'Median debt at graduation (completers)',
    type: 'integer',
    sortable: true,
    category: 'aid',
  },
  {
    path: 'latest.aid.median_debt.noncompleters',
    description: 'Median debt for non-completers',
    type: 'integer',
    sortable: false,
    category: 'aid',
  },
  {
    path: 'latest.aid.pell_grant_rate',
    description: 'Share of undergrads receiving Pell grants',
    type: 'float',
    sortable: true,
    category: 'aid',
  },
  {
    path: 'latest.aid.federal_loan_rate',
    description: 'Share of undergrads receiving federal loans',
    type: 'float',
    sortable: true,
    category: 'aid',
  },
  {
    path: 'latest.repayment.repayment_cohort.3_year_declining_balance',
    description:
      'Share of borrowers paying down principal (declining loan balance) 3 years after entering repayment (0–1)',
    type: 'float',
    sortable: true,
    category: 'aid',
  },
  {
    path: 'latest.repayment.repayment_cohort.1_year_declining_balance',
    description:
      'Share of borrowers paying down principal (declining loan balance) 1 year after entering repayment (0–1)',
    type: 'float',
    sortable: false,
    category: 'aid',
  },
  {
    path: 'latest.repayment.repayment_cohort.5_year_declining_balance',
    description:
      'Share of borrowers paying down principal (declining loan balance) 5 years after entering repayment (0–1)',
    type: 'float',
    sortable: false,
    category: 'aid',
  },

  // Completion / Outcomes
  {
    path: 'latest.completion.rate_suppressed.overall',
    description: 'Completion rate at 150% normal time (overall)',
    type: 'float',
    sortable: true,
    category: 'completion',
  },
  {
    path: 'latest.completion.rate_suppressed.lt_four_year_150percent',
    description: 'Completion rate for <4-year programs at 150% time',
    type: 'float',
    sortable: false,
    category: 'completion',
  },
  {
    path: 'latest.completion.consumer_rate',
    description: 'Consumer-friendly completion rate',
    type: 'float',
    sortable: false,
    category: 'completion',
  },

  // Earnings — Institution Level
  {
    path: 'latest.earnings.6_yrs_after_entry.median',
    description: 'Median earnings 6 years after entry',
    type: 'integer',
    sortable: true,
    category: 'earnings',
  },
  {
    path: 'latest.earnings.8_yrs_after_entry.median_earnings',
    description: 'Median earnings 8 years after entry',
    type: 'integer',
    sortable: true,
    category: 'earnings',
  },
  {
    path: 'latest.earnings.10_yrs_after_entry.median',
    description: 'Median earnings 10 years after entry',
    type: 'integer',
    sortable: true,
    category: 'earnings',
  },
  {
    path: 'latest.earnings.6_yrs_after_entry.percent_greater_than_25000',
    description: 'Share earning >$25k at 6 years',
    type: 'float',
    sortable: false,
    category: 'earnings',
  },
  {
    path: 'latest.earnings.6_yrs_after_entry.percent_greater_than_100000',
    description: 'Share earning >$100k at 6 years',
    type: 'float',
    sortable: false,
    category: 'earnings',
  },
  {
    path: 'latest.earnings.mean_annual_increment',
    description: 'Mean annual earnings increment',
    type: 'float',
    sortable: false,
    category: 'earnings',
  },

  // Earnings percentiles
  {
    path: 'latest.earnings.6_yrs_after_entry.percentile25',
    description: '25th percentile earnings at 6 years',
    type: 'integer',
    sortable: false,
    category: 'earnings',
  },
  {
    path: 'latest.earnings.6_yrs_after_entry.percentile75',
    description: '75th percentile earnings at 6 years',
    type: 'integer',
    sortable: false,
    category: 'earnings',
  },
  {
    path: 'latest.earnings.10_yrs_after_entry.percentile25',
    description: '25th percentile earnings at 10 years',
    type: 'integer',
    sortable: false,
    category: 'earnings',
  },
  {
    path: 'latest.earnings.10_yrs_after_entry.percentile75',
    description: '75th percentile earnings at 10 years',
    type: 'integer',
    sortable: false,
    category: 'earnings',
  },

  // Earnings by gender
  {
    path: 'latest.earnings.6_yrs_after_entry.female_students.median_earnings',
    description: 'Median earnings for female students at 6 years',
    type: 'integer',
    sortable: false,
    category: 'earnings',
  },
  {
    path: 'latest.earnings.6_yrs_after_entry.male_students.median_earnings',
    description: 'Median earnings for male students at 6 years',
    type: 'integer',
    sortable: false,
    category: 'earnings',
  },

  // Demographics
  {
    path: 'latest.student.demographics.race_ethnicity.white',
    description: 'Share of students identifying as white',
    type: 'float',
    sortable: false,
    category: 'demographics',
  },
  {
    path: 'latest.student.demographics.race_ethnicity.black',
    description: 'Share of students identifying as Black',
    type: 'float',
    sortable: false,
    category: 'demographics',
  },
  {
    path: 'latest.student.demographics.race_ethnicity.hispanic',
    description: 'Share of students identifying as Hispanic',
    type: 'float',
    sortable: false,
    category: 'demographics',
  },
  {
    path: 'latest.student.demographics.race_ethnicity.asian',
    description: 'Share of students identifying as Asian',
    type: 'float',
    sortable: false,
    category: 'demographics',
  },
  {
    path: 'latest.student.demographics.first_generation',
    description: 'Share of first-generation college students',
    type: 'float',
    sortable: false,
    category: 'demographics',
  },
  {
    path: 'latest.student.demographics.age_entry',
    description: 'Average age at entry',
    type: 'float',
    sortable: false,
    category: 'demographics',
  },
  {
    path: 'latest.student.demographics.female_share',
    description: 'Share of undergraduate students who are female',
    type: 'float',
    sortable: false,
    category: 'demographics',
  },
  {
    path: 'latest.student.part_time_share',
    description: 'Share of undergrads enrolled part-time',
    type: 'float',
    sortable: false,
    category: 'demographics',
  },

  // Programs — Field of Study
  {
    path: 'latest.programs.cip_4_digit.code',
    description: 'CIP 4-digit program code (e.g. "11.07")',
    type: 'string',
    sortable: false,
    category: 'programs',
  },
  {
    path: 'latest.programs.cip_4_digit.title',
    description: 'Program title',
    type: 'string',
    sortable: false,
    category: 'programs',
  },
  {
    path: 'latest.programs.cip_4_digit.earnings.highest.1_yr.overall_median_earnings',
    description: 'Median earnings 1 year after graduation by program',
    type: 'integer',
    sortable: false,
    category: 'programs',
  },
  {
    path: 'latest.programs.cip_4_digit.earnings.highest.1_yr.overall_count_titleiv',
    description: 'Number of Title IV students used for program earnings',
    type: 'integer',
    sortable: false,
    category: 'programs',
  },
  {
    path: 'latest.programs.cip_4_digit.debt.median_debt',
    description: 'Median debt at graduation by program',
    type: 'integer',
    sortable: false,
    category: 'programs',
  },
  {
    path: 'latest.programs.cip_4_digit.counts.ipeds_enrollment',
    description: 'IPEDS enrollment count by program',
    type: 'integer',
    sortable: false,
    category: 'programs',
  },
  {
    path: 'latest.programs.cip_4_digit.credential_level',
    description:
      'Credential level: 1=undergraduate certificate, 2=associate, 3=bachelor, 4=post-baccalaureate certificate, 5=master, 6=doctoral, 7=first professional, 8=graduate/professional certificate, 99=non-credential',
    type: 'integer',
    sortable: false,
    category: 'programs',
  },
];

/**
 * Search the field catalog by keyword — matches path, description, or category.
 * Returns up to `limit` results (default 30).
 */
export function searchFieldCatalog(query: string, limit = 30): FieldEntry[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return FIELD_CATALOG.slice(0, limit);

  const scored: Array<{ entry: FieldEntry; score: number }> = [];
  for (const entry of FIELD_CATALOG) {
    const haystack = `${entry.path} ${entry.description} ${entry.category}`.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (haystack.includes(term)) {
        score++;
        if (entry.path.includes(term)) score++;
        if (entry.category === term) score += 2;
      }
    }
    if (score > 0) scored.push({ entry, score });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.entry);
}
