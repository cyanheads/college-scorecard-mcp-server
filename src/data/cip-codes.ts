/**
 * @fileoverview Embedded CIP (Classification of Instructional Programs) code taxonomy.
 * Derived from NCES CIP 2020 taxonomy. Static data — no API call required.
 * @module data/cip-codes
 */

export interface CipEntry {
  /** 4-digit CIP code (e.g. "11.07") */
  code: string;
  /** 2-digit family code (e.g. "11") */
  family: string;
  /** Family name (e.g. "Computer And Information Sciences And Support Services") */
  familyTitle: string;
  /** Standard title for the program (e.g. "Computer Science") */
  title: string;
}

/** 4-digit CIP code taxonomy — common programs for college/career exploration. */
export const CIP_CODES: CipEntry[] = [
  // 01 — Agriculture
  {
    code: '01.00',
    title: 'Agriculture, General',
    family: '01',
    familyTitle: 'Agriculture, Agriculture Operations, And Related Sciences',
  },
  {
    code: '01.01',
    title: 'Agricultural Business And Management, General',
    family: '01',
    familyTitle: 'Agriculture, Agriculture Operations, And Related Sciences',
  },
  {
    code: '01.10',
    title: 'Food Science',
    family: '01',
    familyTitle: 'Agriculture, Agriculture Operations, And Related Sciences',
  },

  // 03 — Natural Resources
  {
    code: '03.00',
    title: 'Natural Resources/Conservation, General',
    family: '03',
    familyTitle: 'Natural Resources And Conservation',
  },
  {
    code: '03.01',
    title: 'Natural Resources Management And Policy',
    family: '03',
    familyTitle: 'Natural Resources And Conservation',
  },
  {
    code: '03.02',
    title: 'Environmental Studies',
    family: '03',
    familyTitle: 'Natural Resources And Conservation',
  },

  // 04 — Architecture
  {
    code: '04.02',
    title: 'Architecture',
    family: '04',
    familyTitle: 'Architecture And Related Services',
  },
  {
    code: '04.04',
    title: 'Environmental Design/Architecture',
    family: '04',
    familyTitle: 'Architecture And Related Services',
  },
  {
    code: '04.06',
    title: 'Landscape Architecture',
    family: '04',
    familyTitle: 'Architecture And Related Services',
  },

  // 09 — Communication
  {
    code: '09.01',
    title: 'Communication, General',
    family: '09',
    familyTitle: 'Communication, Journalism, And Related Programs',
  },
  {
    code: '09.07',
    title: 'Radio And Television',
    family: '09',
    familyTitle: 'Communication, Journalism, And Related Programs',
  },
  {
    code: '09.09',
    title: 'Public Relations, Advertising, And Applied Communication',
    family: '09',
    familyTitle: 'Communication, Journalism, And Related Programs',
  },
  {
    code: '09.10',
    title: 'Journalism',
    family: '09',
    familyTitle: 'Communication, Journalism, And Related Programs',
  },

  // 10 — Communications Technology
  {
    code: '10.03',
    title: 'Graphic Communications',
    family: '10',
    familyTitle: 'Communications Technologies/Technicians And Support Services',
  },

  // 11 — Computer Science
  {
    code: '11.00',
    title: 'Computer And Information Sciences, General',
    family: '11',
    familyTitle: 'Computer And Information Sciences And Support Services',
  },
  {
    code: '11.01',
    title: 'Computer And Information Sciences, General',
    family: '11',
    familyTitle: 'Computer And Information Sciences And Support Services',
  },
  {
    code: '11.02',
    title: 'Computer Programming',
    family: '11',
    familyTitle: 'Computer And Information Sciences And Support Services',
  },
  {
    code: '11.03',
    title: 'Data Processing',
    family: '11',
    familyTitle: 'Computer And Information Sciences And Support Services',
  },
  {
    code: '11.04',
    title: 'Information Science/Studies',
    family: '11',
    familyTitle: 'Computer And Information Sciences And Support Services',
  },
  {
    code: '11.05',
    title: 'Computer Systems Analysis',
    family: '11',
    familyTitle: 'Computer And Information Sciences And Support Services',
  },
  {
    code: '11.06',
    title: 'Data Entry/Microcomputer Applications',
    family: '11',
    familyTitle: 'Computer And Information Sciences And Support Services',
  },
  {
    code: '11.07',
    title: 'Computer Science',
    family: '11',
    familyTitle: 'Computer And Information Sciences And Support Services',
  },
  {
    code: '11.08',
    title: 'Computer Software And Media Applications',
    family: '11',
    familyTitle: 'Computer And Information Sciences And Support Services',
  },
  {
    code: '11.09',
    title: 'Computer Systems Networking And Telecommunications',
    family: '11',
    familyTitle: 'Computer And Information Sciences And Support Services',
  },
  {
    code: '11.10',
    title: 'Computer/Information Technology Services Administration And Management',
    family: '11',
    familyTitle: 'Computer And Information Sciences And Support Services',
  },
  {
    code: '11.16',
    title: 'Modeling, Virtual Environments And Simulation',
    family: '11',
    familyTitle: 'Computer And Information Sciences And Support Services',
  },

  // 13 — Education
  { code: '13.01', title: 'Education, General', family: '13', familyTitle: 'Education' },
  {
    code: '13.02',
    title: 'Bilingual, Multilingual, And Multicultural Education',
    family: '13',
    familyTitle: 'Education',
  },
  { code: '13.03', title: 'Curriculum And Instruction', family: '13', familyTitle: 'Education' },
  {
    code: '13.06',
    title: 'Educational Assessment, Testing, And Measurement',
    family: '13',
    familyTitle: 'Education',
  },
  {
    code: '13.10',
    title: 'Special Education And Teaching',
    family: '13',
    familyTitle: 'Education',
  },
  {
    code: '13.12',
    title: 'Teacher Education And Professional Development, Specific Levels And Methods',
    family: '13',
    familyTitle: 'Education',
  },
  {
    code: '13.13',
    title: 'Teacher Education And Professional Development, Specific Subject Areas',
    family: '13',
    familyTitle: 'Education',
  },

  // 14 — Engineering
  { code: '14.00', title: 'Engineering, General', family: '14', familyTitle: 'Engineering' },
  { code: '14.01', title: 'Engineering, General', family: '14', familyTitle: 'Engineering' },
  { code: '14.03', title: 'Agricultural Engineering', family: '14', familyTitle: 'Engineering' },
  { code: '14.04', title: 'Architectural Engineering', family: '14', familyTitle: 'Engineering' },
  {
    code: '14.05',
    title: 'Biomedical/Medical Engineering',
    family: '14',
    familyTitle: 'Engineering',
  },
  {
    code: '14.06',
    title: 'Ceramic Sciences And Engineering',
    family: '14',
    familyTitle: 'Engineering',
  },
  { code: '14.07', title: 'Chemical Engineering', family: '14', familyTitle: 'Engineering' },
  { code: '14.08', title: 'Civil Engineering, General', family: '14', familyTitle: 'Engineering' },
  {
    code: '14.09',
    title: 'Computer Engineering, General',
    family: '14',
    familyTitle: 'Engineering',
  },
  {
    code: '14.10',
    title: 'Electrical And Electronics Engineering',
    family: '14',
    familyTitle: 'Engineering',
  },
  {
    code: '14.12',
    title: 'Engineering Physics/Applied Physics',
    family: '14',
    familyTitle: 'Engineering',
  },
  { code: '14.13', title: 'Engineering Science', family: '14', familyTitle: 'Engineering' },
  {
    code: '14.14',
    title: 'Environmental/Environmental Health Engineering',
    family: '14',
    familyTitle: 'Engineering',
  },
  { code: '14.18', title: 'Materials Engineering', family: '14', familyTitle: 'Engineering' },
  { code: '14.19', title: 'Mechanical Engineering', family: '14', familyTitle: 'Engineering' },
  { code: '14.20', title: 'Metallurgical Engineering', family: '14', familyTitle: 'Engineering' },
  {
    code: '14.22',
    title: 'Naval Architecture And Marine Engineering',
    family: '14',
    familyTitle: 'Engineering',
  },
  { code: '14.23', title: 'Nuclear Engineering', family: '14', familyTitle: 'Engineering' },
  { code: '14.24', title: 'Ocean Engineering', family: '14', familyTitle: 'Engineering' },
  { code: '14.25', title: 'Petroleum Engineering', family: '14', familyTitle: 'Engineering' },
  { code: '14.27', title: 'Systems Engineering', family: '14', familyTitle: 'Engineering' },
  {
    code: '14.28',
    title: 'Textile Sciences And Engineering',
    family: '14',
    familyTitle: 'Engineering',
  },
  {
    code: '14.32',
    title: 'Polymer/Plastics Engineering',
    family: '14',
    familyTitle: 'Engineering',
  },
  { code: '14.33', title: 'Construction Engineering', family: '14', familyTitle: 'Engineering' },
  { code: '14.34', title: 'Forest Engineering', family: '14', familyTitle: 'Engineering' },
  { code: '14.35', title: 'Industrial Engineering', family: '14', familyTitle: 'Engineering' },
  { code: '14.36', title: 'Manufacturing Engineering', family: '14', familyTitle: 'Engineering' },
  { code: '14.37', title: 'Operations Research', family: '14', familyTitle: 'Engineering' },
  { code: '14.38', title: 'Surveying Engineering', family: '14', familyTitle: 'Engineering' },
  {
    code: '14.39',
    title: 'Geological/Geophysical Engineering',
    family: '14',
    familyTitle: 'Engineering',
  },
  {
    code: '14.40',
    title: 'Paper Science And Engineering',
    family: '14',
    familyTitle: 'Engineering',
  },
  {
    code: '14.41',
    title: 'Electromechanical Engineering',
    family: '14',
    familyTitle: 'Engineering',
  },
  { code: '14.43', title: 'Biochemical Engineering', family: '14', familyTitle: 'Engineering' },
  { code: '14.44', title: 'Engineering Chemistry', family: '14', familyTitle: 'Engineering' },
  {
    code: '14.45',
    title: 'Biological/Biosystems Engineering',
    family: '14',
    familyTitle: 'Engineering',
  },
  {
    code: '14.47',
    title: 'Electrical And Computer Engineering',
    family: '14',
    familyTitle: 'Engineering',
  },

  // 15 — Engineering Technology
  {
    code: '15.00',
    title: 'Engineering Technology, General',
    family: '15',
    familyTitle: 'Engineering/Engineering-Related Technologies/Technicians',
  },
  {
    code: '15.03',
    title: 'Electrical, Electronic And Communications Engineering Technology',
    family: '15',
    familyTitle: 'Engineering/Engineering-Related Technologies/Technicians',
  },
  {
    code: '15.08',
    title: 'Mechanical Engineering Related Technologies/Technicians',
    family: '15',
    familyTitle: 'Engineering/Engineering-Related Technologies/Technicians',
  },

  // 16 — Foreign Languages
  {
    code: '16.01',
    title: 'Linguistic, Comparative, And Related Language Studies And Services',
    family: '16',
    familyTitle: 'Foreign Languages, Literatures, And Linguistics',
  },
  {
    code: '16.09',
    title: 'Romance Languages, Literatures, And Linguistics',
    family: '16',
    familyTitle: 'Foreign Languages, Literatures, And Linguistics',
  },

  // 19 — Family and Consumer Sciences
  {
    code: '19.04',
    title: 'Family And Consumer Economics And Related Studies',
    family: '19',
    familyTitle: 'Family And Consumer Sciences/Human Sciences',
  },
  {
    code: '19.05',
    title: 'Foods, Nutrition, And Related Services',
    family: '19',
    familyTitle: 'Family And Consumer Sciences/Human Sciences',
  },
  {
    code: '19.07',
    title: 'Human Development, Family Studies, And Related Services',
    family: '19',
    familyTitle: 'Family And Consumer Sciences/Human Sciences',
  },

  // 22 — Legal Professions
  {
    code: '22.00',
    title: 'Legal Professions And Studies, General',
    family: '22',
    familyTitle: 'Legal Professions And Studies',
  },
  {
    code: '22.03',
    title: 'Legal Support Services',
    family: '22',
    familyTitle: 'Legal Professions And Studies',
  },

  // 23 — English
  {
    code: '23.01',
    title: 'English Language And Literature, General',
    family: '23',
    familyTitle: 'English Language And Literature/Letters',
  },
  {
    code: '23.07',
    title: 'American Literature',
    family: '23',
    familyTitle: 'English Language And Literature/Letters',
  },
  {
    code: '23.13',
    title: 'Writing, General',
    family: '23',
    familyTitle: 'English Language And Literature/Letters',
  },
  {
    code: '23.14',
    title: 'Professional, Technical, Business, And Scientific Writing',
    family: '23',
    familyTitle: 'English Language And Literature/Letters',
  },

  // 24 — Liberal Arts
  {
    code: '24.01',
    title: 'Liberal Arts And Sciences, General Studies And Humanities',
    family: '24',
    familyTitle: 'Liberal Arts And Sciences, General Studies And Humanities',
  },

  // 25 — Library Science
  {
    code: '25.01',
    title: 'Library Science And Administration',
    family: '25',
    familyTitle: 'Library Science',
  },

  // 26 — Biological Sciences
  {
    code: '26.00',
    title: 'Biology, General',
    family: '26',
    familyTitle: 'Biological And Biomedical Sciences',
  },
  {
    code: '26.01',
    title: 'Biology, General',
    family: '26',
    familyTitle: 'Biological And Biomedical Sciences',
  },
  {
    code: '26.02',
    title: 'Biochemistry, Biophysics And Molecular Biology',
    family: '26',
    familyTitle: 'Biological And Biomedical Sciences',
  },
  {
    code: '26.03',
    title: 'Botany/Plant Biology',
    family: '26',
    familyTitle: 'Biological And Biomedical Sciences',
  },
  {
    code: '26.04',
    title: 'Cell/Cellular Biology And Histology',
    family: '26',
    familyTitle: 'Biological And Biomedical Sciences',
  },
  {
    code: '26.05',
    title: 'Microbiological Sciences And Immunology',
    family: '26',
    familyTitle: 'Biological And Biomedical Sciences',
  },
  {
    code: '26.07',
    title: 'Zoology/Animal Biology',
    family: '26',
    familyTitle: 'Biological And Biomedical Sciences',
  },
  {
    code: '26.08',
    title: 'Genetics',
    family: '26',
    familyTitle: 'Biological And Biomedical Sciences',
  },
  {
    code: '26.09',
    title: 'Physiology, Pathology And Related Sciences',
    family: '26',
    familyTitle: 'Biological And Biomedical Sciences',
  },
  {
    code: '26.13',
    title: 'Ecology, Evolution, Systematics And Population Biology',
    family: '26',
    familyTitle: 'Biological And Biomedical Sciences',
  },

  // 27 — Mathematics
  { code: '27.01', title: 'Mathematics', family: '27', familyTitle: 'Mathematics And Statistics' },
  {
    code: '27.03',
    title: 'Applied Mathematics, General',
    family: '27',
    familyTitle: 'Mathematics And Statistics',
  },
  {
    code: '27.05',
    title: 'Statistics, General',
    family: '27',
    familyTitle: 'Mathematics And Statistics',
  },

  // 28 — Military Science
  {
    code: '28.02',
    title: 'Military Science, Leadership And Operational Art',
    family: '28',
    familyTitle: 'Military Science, Leadership, And Operational Art',
  },

  // 29 — Military Technology
  {
    code: '29.02',
    title: 'Intelligence, Command Control And Information Operations',
    family: '29',
    familyTitle: 'Military Technologies And Applied Sciences',
  },

  // 30 — Multi/Interdisciplinary Studies
  {
    code: '30.00',
    title: 'Multi/Interdisciplinary Studies, General',
    family: '30',
    familyTitle: 'Multi/Interdisciplinary Studies',
  },
  {
    code: '30.08',
    title: 'Mathematics And Computer Science',
    family: '30',
    familyTitle: 'Multi/Interdisciplinary Studies',
  },
  {
    code: '30.10',
    title: 'Biopsychology',
    family: '30',
    familyTitle: 'Multi/Interdisciplinary Studies',
  },
  {
    code: '30.25',
    title: 'Cognitive Science, General',
    family: '30',
    familyTitle: 'Multi/Interdisciplinary Studies',
  },
  {
    code: '30.30',
    title: 'Computational Science',
    family: '30',
    familyTitle: 'Multi/Interdisciplinary Studies',
  },
  {
    code: '30.41',
    title: 'Economics And Computer Science',
    family: '30',
    familyTitle: 'Multi/Interdisciplinary Studies',
  },
  {
    code: '30.70',
    title: 'Data Science, General',
    family: '30',
    familyTitle: 'Multi/Interdisciplinary Studies',
  },
  {
    code: '30.71',
    title: 'Data Analytics, General',
    family: '30',
    familyTitle: 'Multi/Interdisciplinary Studies',
  },

  // 31 — Parks and Recreation
  {
    code: '31.05',
    title: 'Health And Physical Education/Fitness, General',
    family: '31',
    familyTitle: 'Parks, Recreation, Leisure, Fitness, And Kinesiology',
  },

  // 38 — Philosophy
  {
    code: '38.01',
    title: 'Philosophy',
    family: '38',
    familyTitle: 'Philosophy And Religious Studies',
  },
  {
    code: '38.02',
    title: 'Religion/Religious Studies',
    family: '38',
    familyTitle: 'Philosophy And Religious Studies',
  },

  // 40 — Physical Sciences
  {
    code: '40.02',
    title: 'Astronomy And Astrophysics',
    family: '40',
    familyTitle: 'Physical Sciences',
  },
  {
    code: '40.04',
    title: 'Atmospheric Sciences And Meteorology, General',
    family: '40',
    familyTitle: 'Physical Sciences',
  },
  { code: '40.05', title: 'Chemistry, General', family: '40', familyTitle: 'Physical Sciences' },
  {
    code: '40.06',
    title: 'Geological And Earth Sciences/Geosciences',
    family: '40',
    familyTitle: 'Physical Sciences',
  },
  { code: '40.08', title: 'Physics, General', family: '40', familyTitle: 'Physical Sciences' },

  // 41 — Science Technologies
  {
    code: '41.03',
    title: 'Physical Science Technologies/Technicians',
    family: '41',
    familyTitle: 'Science Technologies/Technicians',
  },

  // 42 — Psychology
  { code: '42.01', title: 'Psychology, General', family: '42', familyTitle: 'Psychology' },
  {
    code: '42.16',
    title: 'Cognitive Psychology And Psycholinguistics',
    family: '42',
    familyTitle: 'Psychology',
  },
  { code: '42.17', title: 'Comparative Psychology', family: '42', familyTitle: 'Psychology' },
  { code: '42.18', title: 'Community Psychology', family: '42', familyTitle: 'Psychology' },
  {
    code: '42.19',
    title: 'Developmental And Child Psychology',
    family: '42',
    familyTitle: 'Psychology',
  },
  {
    code: '42.23',
    title: 'Research And Experimental Psychology',
    family: '42',
    familyTitle: 'Psychology',
  },
  { code: '42.26', title: 'Neuropsychology', family: '42', familyTitle: 'Psychology' },
  { code: '42.27', title: 'Forensic Psychology', family: '42', familyTitle: 'Psychology' },
  { code: '42.28', title: 'Health/Medical Psychology', family: '42', familyTitle: 'Psychology' },

  // 43 — Security and Law Enforcement
  {
    code: '43.01',
    title: 'Criminal Justice/Safety Studies',
    family: '43',
    familyTitle: 'Homeland Security, Law Enforcement, Firefighting And Related Protective Services',
  },
  {
    code: '43.02',
    title: 'Fire Protection',
    family: '43',
    familyTitle: 'Homeland Security, Law Enforcement, Firefighting And Related Protective Services',
  },
  {
    code: '43.03',
    title: 'Security And Protective Services',
    family: '43',
    familyTitle: 'Homeland Security, Law Enforcement, Firefighting And Related Protective Services',
  },
  {
    code: '43.07',
    title: 'Forensic Science And Technology',
    family: '43',
    familyTitle: 'Homeland Security, Law Enforcement, Firefighting And Related Protective Services',
  },

  // 44 — Public Administration
  {
    code: '44.00',
    title: 'Public Administration And Social Service Professions, General',
    family: '44',
    familyTitle: 'Public Administration And Social Service Professions',
  },
  {
    code: '44.02',
    title: 'Community Organization And Advocacy',
    family: '44',
    familyTitle: 'Public Administration And Social Service Professions',
  },
  {
    code: '44.04',
    title: 'Public Administration',
    family: '44',
    familyTitle: 'Public Administration And Social Service Professions',
  },
  {
    code: '44.07',
    title: 'Social Work',
    family: '44',
    familyTitle: 'Public Administration And Social Service Professions',
  },

  // 45 — Social Sciences
  {
    code: '45.01',
    title: 'Social Sciences, General',
    family: '45',
    familyTitle: 'Social Sciences',
  },
  { code: '45.02', title: 'Anthropology', family: '45', familyTitle: 'Social Sciences' },
  { code: '45.03', title: 'Archeology', family: '45', familyTitle: 'Social Sciences' },
  { code: '45.04', title: 'Criminology', family: '45', familyTitle: 'Social Sciences' },
  {
    code: '45.05',
    title: 'Demography And Population Studies',
    family: '45',
    familyTitle: 'Social Sciences',
  },
  { code: '45.06', title: 'Economics, General', family: '45', familyTitle: 'Social Sciences' },
  {
    code: '45.07',
    title: 'Geography And Cartography',
    family: '45',
    familyTitle: 'Social Sciences',
  },
  { code: '45.08', title: 'Sociology', family: '45', familyTitle: 'Social Sciences' },
  {
    code: '45.09',
    title: 'International Relations And National Security Studies',
    family: '45',
    familyTitle: 'Social Sciences',
  },
  {
    code: '45.10',
    title: 'Political Science And Government, General',
    family: '45',
    familyTitle: 'Social Sciences',
  },
  { code: '45.11', title: 'Sociology', family: '45', familyTitle: 'Social Sciences' },

  // 50 — Visual and Performing Arts
  {
    code: '50.01',
    title: 'Visual And Performing Arts, General',
    family: '50',
    familyTitle: 'Visual And Performing Arts',
  },
  {
    code: '50.02',
    title: 'Crafts/Craft Design, Folk Art And Artisanry',
    family: '50',
    familyTitle: 'Visual And Performing Arts',
  },
  { code: '50.03', title: 'Dance', family: '50', familyTitle: 'Visual And Performing Arts' },
  {
    code: '50.04',
    title: 'Design And Applied Arts',
    family: '50',
    familyTitle: 'Visual And Performing Arts',
  },
  {
    code: '50.05',
    title: 'Drama/Theatre Arts And Stagecraft',
    family: '50',
    familyTitle: 'Visual And Performing Arts',
  },
  {
    code: '50.06',
    title: 'Film/Video And Photographic Arts',
    family: '50',
    familyTitle: 'Visual And Performing Arts',
  },
  {
    code: '50.07',
    title: 'Fine And Studio Arts',
    family: '50',
    familyTitle: 'Visual And Performing Arts',
  },
  { code: '50.09', title: 'Music', family: '50', familyTitle: 'Visual And Performing Arts' },
  {
    code: '50.10',
    title: 'Arts, Entertainment, And Media Management',
    family: '50',
    familyTitle: 'Visual And Performing Arts',
  },

  // 51 — Health Professions
  {
    code: '51.00',
    title: 'Health Services/Allied Health/Health Sciences, General',
    family: '51',
    familyTitle: 'Health Professions And Related Programs',
  },
  {
    code: '51.01',
    title: 'Chiropractic',
    family: '51',
    familyTitle: 'Health Professions And Related Programs',
  },
  {
    code: '51.02',
    title: 'Communication Disorders Sciences And Services',
    family: '51',
    familyTitle: 'Health Professions And Related Programs',
  },
  {
    code: '51.04',
    title: 'Dentistry',
    family: '51',
    familyTitle: 'Health Professions And Related Programs',
  },
  {
    code: '51.05',
    title: 'Advanced/Graduate Dentistry And Oral Sciences',
    family: '51',
    familyTitle: 'Health Professions And Related Programs',
  },
  {
    code: '51.06',
    title: 'Dental Support Services And Allied Professions',
    family: '51',
    familyTitle: 'Health Professions And Related Programs',
  },
  {
    code: '51.07',
    title: 'Health And Medical Administrative Services',
    family: '51',
    familyTitle: 'Health Professions And Related Programs',
  },
  {
    code: '51.08',
    title: 'Allied Health And Medical Assisting Services',
    family: '51',
    familyTitle: 'Health Professions And Related Programs',
  },
  {
    code: '51.09',
    title: 'Allied Health Diagnostic, Intervention, And Treatment Professions',
    family: '51',
    familyTitle: 'Health Professions And Related Programs',
  },
  {
    code: '51.10',
    title: 'Clinical/Medical Laboratory Science/Research And Allied Professions',
    family: '51',
    familyTitle: 'Health Professions And Related Programs',
  },
  {
    code: '51.11',
    title: 'Health/Medical Preparatory Programs',
    family: '51',
    familyTitle: 'Health Professions And Related Programs',
  },
  {
    code: '51.12',
    title: 'Medicine',
    family: '51',
    familyTitle: 'Health Professions And Related Programs',
  },
  {
    code: '51.14',
    title: 'Medical Clinical Sciences/Graduate Medical Studies',
    family: '51',
    familyTitle: 'Health Professions And Related Programs',
  },
  {
    code: '51.15',
    title: 'Mental And Social Health Services And Allied Professions',
    family: '51',
    familyTitle: 'Health Professions And Related Programs',
  },
  {
    code: '51.17',
    title: 'Optometry',
    family: '51',
    familyTitle: 'Health Professions And Related Programs',
  },
  {
    code: '51.18',
    title: 'Ophthalmic And Optometric Support Services And Allied Professions',
    family: '51',
    familyTitle: 'Health Professions And Related Programs',
  },
  {
    code: '51.20',
    title: 'Pharmacy, Pharmaceutical Sciences, And Administration',
    family: '51',
    familyTitle: 'Health Professions And Related Programs',
  },
  {
    code: '51.22',
    title: 'Public Health',
    family: '51',
    familyTitle: 'Health Professions And Related Programs',
  },
  {
    code: '51.23',
    title: 'Rehabilitation And Therapeutic Professions',
    family: '51',
    familyTitle: 'Health Professions And Related Programs',
  },
  {
    code: '51.26',
    title: 'Health Aides/Attendants/Orderlies',
    family: '51',
    familyTitle: 'Health Professions And Related Programs',
  },
  {
    code: '51.27',
    title: 'Medical Illustration And Informatics',
    family: '51',
    familyTitle: 'Health Professions And Related Programs',
  },
  {
    code: '51.31',
    title: 'Dietetics And Clinical Nutrition Services',
    family: '51',
    familyTitle: 'Health Professions And Related Programs',
  },
  {
    code: '51.36',
    title: 'Movement And Mind-Body Therapies And Education',
    family: '51',
    familyTitle: 'Health Professions And Related Programs',
  },
  {
    code: '51.37',
    title: 'Somatic Bodywork And Related Therapeutic Services',
    family: '51',
    familyTitle: 'Health Professions And Related Programs',
  },
  {
    code: '51.38',
    title: 'Registered Nursing, Nursing Administration, Nursing Research And Clinical Nursing',
    family: '51',
    familyTitle: 'Health Professions And Related Programs',
  },
  {
    code: '51.39',
    title: 'Practical Nursing, Vocational Nursing And Nursing Assistants',
    family: '51',
    familyTitle: 'Health Professions And Related Programs',
  },

  // 52 — Business
  {
    code: '52.00',
    title: 'Business, Management, Marketing, And Related Support Services, General',
    family: '52',
    familyTitle: 'Business, Management, Marketing, And Related Support Services',
  },
  {
    code: '52.01',
    title: 'Business/Commerce, General',
    family: '52',
    familyTitle: 'Business, Management, Marketing, And Related Support Services',
  },
  {
    code: '52.02',
    title: 'Business Administration, Management And Operations',
    family: '52',
    familyTitle: 'Business, Management, Marketing, And Related Support Services',
  },
  {
    code: '52.03',
    title: 'Accounting And Related Services',
    family: '52',
    familyTitle: 'Business, Management, Marketing, And Related Support Services',
  },
  {
    code: '52.04',
    title: 'Business Operations Support And Assistant Services',
    family: '52',
    familyTitle: 'Business, Management, Marketing, And Related Support Services',
  },
  {
    code: '52.05',
    title: 'Business/Corporate Communications',
    family: '52',
    familyTitle: 'Business, Management, Marketing, And Related Support Services',
  },
  {
    code: '52.06',
    title: 'Business/Managerial Economics',
    family: '52',
    familyTitle: 'Business, Management, Marketing, And Related Support Services',
  },
  {
    code: '52.07',
    title: 'Entrepreneurship And Small Business Operations',
    family: '52',
    familyTitle: 'Business, Management, Marketing, And Related Support Services',
  },
  {
    code: '52.08',
    title: 'Finance And Financial Management Services',
    family: '52',
    familyTitle: 'Business, Management, Marketing, And Related Support Services',
  },
  {
    code: '52.09',
    title: 'Hospitality Administration/Management',
    family: '52',
    familyTitle: 'Business, Management, Marketing, And Related Support Services',
  },
  {
    code: '52.10',
    title: 'Human Resources Management And Services',
    family: '52',
    familyTitle: 'Business, Management, Marketing, And Related Support Services',
  },
  {
    code: '52.11',
    title: 'International Business',
    family: '52',
    familyTitle: 'Business, Management, Marketing, And Related Support Services',
  },
  {
    code: '52.12',
    title: 'Management Information Systems And Services',
    family: '52',
    familyTitle: 'Business, Management, Marketing, And Related Support Services',
  },
  {
    code: '52.13',
    title: 'Management Sciences And Quantitative Methods',
    family: '52',
    familyTitle: 'Business, Management, Marketing, And Related Support Services',
  },
  {
    code: '52.14',
    title: 'Marketing',
    family: '52',
    familyTitle: 'Business, Management, Marketing, And Related Support Services',
  },
  {
    code: '52.15',
    title: 'Real Estate',
    family: '52',
    familyTitle: 'Business, Management, Marketing, And Related Support Services',
  },
  {
    code: '52.16',
    title: 'Taxation',
    family: '52',
    familyTitle: 'Business, Management, Marketing, And Related Support Services',
  },
  {
    code: '52.17',
    title: 'Insurance',
    family: '52',
    familyTitle: 'Business, Management, Marketing, And Related Support Services',
  },
  {
    code: '52.18',
    title: 'General Sales, Merchandising And Related Marketing Operations',
    family: '52',
    familyTitle: 'Business, Management, Marketing, And Related Support Services',
  },
  {
    code: '52.19',
    title: 'Specialized Sales, Merchandising And Marketing Operations',
    family: '52',
    familyTitle: 'Business, Management, Marketing, And Related Support Services',
  },

  // 54 — History
  { code: '54.01', title: 'History', family: '54', familyTitle: 'History' },

  // 60 — Residency programs
  {
    code: '60.04',
    title: 'Dentistry Residency Programs',
    family: '60',
    familyTitle: 'Residency Programs',
  },
];

/**
 * Search CIP codes by keyword — matches against code, title, family title.
 * Returns up to `limit` results (default 20).
 */
export function searchCipCodes(query: string, limit = 20): CipEntry[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return CIP_CODES.slice(0, limit);

  const scored: Array<{ entry: CipEntry; score: number }> = [];
  for (const entry of CIP_CODES) {
    const haystack = `${entry.code} ${entry.title} ${entry.familyTitle}`.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (haystack.includes(term)) {
        score++;
        // Boost exact title match
        if (entry.title.toLowerCase().includes(term)) score++;
        if (entry.code.startsWith(term)) score += 2;
      }
    }
    if (score > 0) scored.push({ entry, score });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.entry);
}
