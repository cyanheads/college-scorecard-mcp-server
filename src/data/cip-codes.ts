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

/** Curated current four-digit groups, with exact NCES CIP 2020 titles and family names. */
export const CIP_CODES: CipEntry[] = [
  {
    code: '01.00',
    title: 'Agriculture, General.',
    family: '01',
    familyTitle: 'AGRICULTURAL/ANIMAL/PLANT/VETERINARY SCIENCE AND RELATED FIELDS.',
  },
  {
    code: '01.01',
    title: 'Agricultural Business and Management.',
    family: '01',
    familyTitle: 'AGRICULTURAL/ANIMAL/PLANT/VETERINARY SCIENCE AND RELATED FIELDS.',
  },
  {
    code: '01.10',
    title: 'Food Science and Technology.',
    family: '01',
    familyTitle: 'AGRICULTURAL/ANIMAL/PLANT/VETERINARY SCIENCE AND RELATED FIELDS.',
  },
  {
    code: '03.01',
    title: 'Natural Resources Conservation and Research.',
    family: '03',
    familyTitle: 'NATURAL RESOURCES AND CONSERVATION.',
  },
  {
    code: '03.02',
    title: 'Environmental/Natural Resources Management and Policy.',
    family: '03',
    familyTitle: 'NATURAL RESOURCES AND CONSERVATION.',
  },
  {
    code: '04.02',
    title: 'Architecture.',
    family: '04',
    familyTitle: 'ARCHITECTURE AND RELATED SERVICES.',
  },
  {
    code: '04.04',
    title: 'Environmental Design.',
    family: '04',
    familyTitle: 'ARCHITECTURE AND RELATED SERVICES.',
  },
  {
    code: '04.06',
    title: 'Landscape Architecture.',
    family: '04',
    familyTitle: 'ARCHITECTURE AND RELATED SERVICES.',
  },
  {
    code: '09.01',
    title: 'Communication and Media Studies.',
    family: '09',
    familyTitle: 'COMMUNICATION, JOURNALISM, AND RELATED PROGRAMS.',
  },
  {
    code: '09.07',
    title: 'Radio, Television, and Digital Communication.',
    family: '09',
    familyTitle: 'COMMUNICATION, JOURNALISM, AND RELATED PROGRAMS.',
  },
  {
    code: '09.09',
    title: 'Public Relations, Advertising, and Applied Communication.',
    family: '09',
    familyTitle: 'COMMUNICATION, JOURNALISM, AND RELATED PROGRAMS.',
  },
  {
    code: '09.04',
    title: 'Journalism.',
    family: '09',
    familyTitle: 'COMMUNICATION, JOURNALISM, AND RELATED PROGRAMS.',
  },
  {
    code: '10.03',
    title: 'Graphic Communications.',
    family: '10',
    familyTitle: 'COMMUNICATIONS TECHNOLOGIES/TECHNICIANS AND SUPPORT SERVICES.',
  },
  {
    code: '11.01',
    title: 'Computer and Information Sciences, General.',
    family: '11',
    familyTitle: 'COMPUTER AND INFORMATION SCIENCES AND SUPPORT SERVICES.',
  },
  {
    code: '11.02',
    title: 'Computer Programming.',
    family: '11',
    familyTitle: 'COMPUTER AND INFORMATION SCIENCES AND SUPPORT SERVICES.',
  },
  {
    code: '11.03',
    title: 'Data Processing.',
    family: '11',
    familyTitle: 'COMPUTER AND INFORMATION SCIENCES AND SUPPORT SERVICES.',
  },
  {
    code: '11.04',
    title: 'Information Science/Studies.',
    family: '11',
    familyTitle: 'COMPUTER AND INFORMATION SCIENCES AND SUPPORT SERVICES.',
  },
  {
    code: '11.05',
    title: 'Computer Systems Analysis.',
    family: '11',
    familyTitle: 'COMPUTER AND INFORMATION SCIENCES AND SUPPORT SERVICES.',
  },
  {
    code: '11.06',
    title: 'Data Entry/Microcomputer Applications.',
    family: '11',
    familyTitle: 'COMPUTER AND INFORMATION SCIENCES AND SUPPORT SERVICES.',
  },
  {
    code: '11.07',
    title: 'Computer Science.',
    family: '11',
    familyTitle: 'COMPUTER AND INFORMATION SCIENCES AND SUPPORT SERVICES.',
  },
  {
    code: '11.08',
    title: 'Computer Software and Media Applications.',
    family: '11',
    familyTitle: 'COMPUTER AND INFORMATION SCIENCES AND SUPPORT SERVICES.',
  },
  {
    code: '11.09',
    title: 'Computer Systems Networking and Telecommunications.',
    family: '11',
    familyTitle: 'COMPUTER AND INFORMATION SCIENCES AND SUPPORT SERVICES.',
  },
  {
    code: '11.10',
    title: 'Computer/Information Technology Administration and Management.',
    family: '11',
    familyTitle: 'COMPUTER AND INFORMATION SCIENCES AND SUPPORT SERVICES.',
  },
  {
    code: '13.01',
    title: 'Education, General.',
    family: '13',
    familyTitle: 'EDUCATION.',
  },
  {
    code: '13.02',
    title: 'Bilingual, Multilingual, and Multicultural Education.',
    family: '13',
    familyTitle: 'EDUCATION.',
  },
  {
    code: '13.03',
    title: 'Curriculum and Instruction.',
    family: '13',
    familyTitle: 'EDUCATION.',
  },
  {
    code: '13.06',
    title: 'Educational Assessment, Evaluation, and Research.',
    family: '13',
    familyTitle: 'EDUCATION.',
  },
  {
    code: '13.10',
    title: 'Special Education and Teaching.',
    family: '13',
    familyTitle: 'EDUCATION.',
  },
  {
    code: '13.12',
    title: 'Teacher Education and Professional Development, Specific Levels and Methods.',
    family: '13',
    familyTitle: 'EDUCATION.',
  },
  {
    code: '13.13',
    title: 'Teacher Education and Professional Development, Specific Subject Areas.',
    family: '13',
    familyTitle: 'EDUCATION.',
  },
  {
    code: '14.01',
    title: 'Engineering, General.',
    family: '14',
    familyTitle: 'ENGINEERING.',
  },
  {
    code: '14.03',
    title: 'Agricultural Engineering.',
    family: '14',
    familyTitle: 'ENGINEERING.',
  },
  {
    code: '14.04',
    title: 'Architectural Engineering.',
    family: '14',
    familyTitle: 'ENGINEERING.',
  },
  {
    code: '14.05',
    title: 'Biomedical/Medical Engineering.',
    family: '14',
    familyTitle: 'ENGINEERING.',
  },
  {
    code: '14.06',
    title: 'Ceramic Sciences and Engineering.',
    family: '14',
    familyTitle: 'ENGINEERING.',
  },
  {
    code: '14.07',
    title: 'Chemical Engineering.',
    family: '14',
    familyTitle: 'ENGINEERING.',
  },
  {
    code: '14.08',
    title: 'Civil Engineering.',
    family: '14',
    familyTitle: 'ENGINEERING.',
  },
  {
    code: '14.09',
    title: 'Computer Engineering.',
    family: '14',
    familyTitle: 'ENGINEERING.',
  },
  {
    code: '14.10',
    title: 'Electrical, Electronics, and Communications Engineering.',
    family: '14',
    familyTitle: 'ENGINEERING.',
  },
  {
    code: '14.12',
    title: 'Engineering Physics.',
    family: '14',
    familyTitle: 'ENGINEERING.',
  },
  {
    code: '14.13',
    title: 'Engineering Science.',
    family: '14',
    familyTitle: 'ENGINEERING.',
  },
  {
    code: '14.14',
    title: 'Environmental/Environmental Health Engineering.',
    family: '14',
    familyTitle: 'ENGINEERING.',
  },
  {
    code: '14.18',
    title: 'Materials Engineering.',
    family: '14',
    familyTitle: 'ENGINEERING.',
  },
  {
    code: '14.19',
    title: 'Mechanical Engineering.',
    family: '14',
    familyTitle: 'ENGINEERING.',
  },
  {
    code: '14.20',
    title: 'Metallurgical Engineering.',
    family: '14',
    familyTitle: 'ENGINEERING.',
  },
  {
    code: '14.22',
    title: 'Naval Architecture and Marine Engineering.',
    family: '14',
    familyTitle: 'ENGINEERING.',
  },
  {
    code: '14.23',
    title: 'Nuclear Engineering.',
    family: '14',
    familyTitle: 'ENGINEERING.',
  },
  {
    code: '14.24',
    title: 'Ocean Engineering.',
    family: '14',
    familyTitle: 'ENGINEERING.',
  },
  {
    code: '14.25',
    title: 'Petroleum Engineering.',
    family: '14',
    familyTitle: 'ENGINEERING.',
  },
  {
    code: '14.27',
    title: 'Systems Engineering.',
    family: '14',
    familyTitle: 'ENGINEERING.',
  },
  {
    code: '14.28',
    title: 'Textile Sciences and Engineering.',
    family: '14',
    familyTitle: 'ENGINEERING.',
  },
  {
    code: '14.32',
    title: 'Polymer/Plastics Engineering.',
    family: '14',
    familyTitle: 'ENGINEERING.',
  },
  {
    code: '14.33',
    title: 'Construction Engineering.',
    family: '14',
    familyTitle: 'ENGINEERING.',
  },
  {
    code: '14.34',
    title: 'Forest Engineering.',
    family: '14',
    familyTitle: 'ENGINEERING.',
  },
  {
    code: '14.35',
    title: 'Industrial Engineering.',
    family: '14',
    familyTitle: 'ENGINEERING.',
  },
  {
    code: '14.36',
    title: 'Manufacturing Engineering.',
    family: '14',
    familyTitle: 'ENGINEERING.',
  },
  {
    code: '14.37',
    title: 'Operations Research.',
    family: '14',
    familyTitle: 'ENGINEERING.',
  },
  {
    code: '14.38',
    title: 'Surveying Engineering.',
    family: '14',
    familyTitle: 'ENGINEERING.',
  },
  {
    code: '14.39',
    title: 'Geological/Geophysical Engineering.',
    family: '14',
    familyTitle: 'ENGINEERING.',
  },
  {
    code: '14.40',
    title: 'Paper Science and Engineering.',
    family: '14',
    familyTitle: 'ENGINEERING.',
  },
  {
    code: '14.41',
    title: 'Electromechanical Engineering.',
    family: '14',
    familyTitle: 'ENGINEERING.',
  },
  {
    code: '14.43',
    title: 'Biochemical Engineering.',
    family: '14',
    familyTitle: 'ENGINEERING.',
  },
  {
    code: '14.44',
    title: 'Engineering Chemistry.',
    family: '14',
    familyTitle: 'ENGINEERING.',
  },
  {
    code: '14.45',
    title: 'Biological/Biosystems Engineering.',
    family: '14',
    familyTitle: 'ENGINEERING.',
  },
  {
    code: '14.47',
    title: 'Electrical and Computer Engineering.',
    family: '14',
    familyTitle: 'ENGINEERING.',
  },
  {
    code: '15.00',
    title: 'Engineering Technologies/Technicians, General.',
    family: '15',
    familyTitle: 'ENGINEERING/ENGINEERING-RELATED TECHNOLOGIES/TECHNICIANS.',
  },
  {
    code: '15.03',
    title: 'Electrical/Electronic Engineering Technologies/Technicians.',
    family: '15',
    familyTitle: 'ENGINEERING/ENGINEERING-RELATED TECHNOLOGIES/TECHNICIANS.',
  },
  {
    code: '15.08',
    title: 'Mechanical Engineering Related Technologies/Technicians.',
    family: '15',
    familyTitle: 'ENGINEERING/ENGINEERING-RELATED TECHNOLOGIES/TECHNICIANS.',
  },
  {
    code: '16.01',
    title: 'Linguistic, Comparative, and Related Language Studies and Services.',
    family: '16',
    familyTitle: 'FOREIGN LANGUAGES, LITERATURES, AND LINGUISTICS.',
  },
  {
    code: '16.09',
    title: 'Romance Languages, Literatures, and Linguistics.',
    family: '16',
    familyTitle: 'FOREIGN LANGUAGES, LITERATURES, AND LINGUISTICS.',
  },
  {
    code: '19.04',
    title: 'Family and Consumer Economics and Related Studies.',
    family: '19',
    familyTitle: 'FAMILY AND CONSUMER SCIENCES/HUMAN SCIENCES.',
  },
  {
    code: '19.05',
    title: 'Foods, Nutrition, and Related Services.',
    family: '19',
    familyTitle: 'FAMILY AND CONSUMER SCIENCES/HUMAN SCIENCES.',
  },
  {
    code: '19.07',
    title: 'Human Development, Family Studies, and Related Services.',
    family: '19',
    familyTitle: 'FAMILY AND CONSUMER SCIENCES/HUMAN SCIENCES.',
  },
  {
    code: '22.00',
    title: 'Non-Professional Legal Studies.',
    family: '22',
    familyTitle: 'LEGAL PROFESSIONS AND STUDIES.',
  },
  {
    code: '22.03',
    title: 'Legal Support Services.',
    family: '22',
    familyTitle: 'LEGAL PROFESSIONS AND STUDIES.',
  },
  {
    code: '23.01',
    title: 'English Language and Literature, General.',
    family: '23',
    familyTitle: 'ENGLISH LANGUAGE AND LITERATURE/LETTERS.',
  },
  {
    code: '23.13',
    title: 'Rhetoric and Composition/Writing Studies.',
    family: '23',
    familyTitle: 'ENGLISH LANGUAGE AND LITERATURE/LETTERS.',
  },
  {
    code: '23.14',
    title: 'Literature.',
    family: '23',
    familyTitle: 'ENGLISH LANGUAGE AND LITERATURE/LETTERS.',
  },
  {
    code: '24.01',
    title: 'Liberal Arts and Sciences, General Studies and Humanities.',
    family: '24',
    familyTitle: 'LIBERAL ARTS AND SCIENCES, GENERAL STUDIES AND HUMANITIES.',
  },
  {
    code: '25.01',
    title: 'Library Science and Administration.',
    family: '25',
    familyTitle: 'LIBRARY SCIENCE.',
  },
  {
    code: '26.01',
    title: 'Biology, General.',
    family: '26',
    familyTitle: 'BIOLOGICAL AND BIOMEDICAL SCIENCES.',
  },
  {
    code: '26.02',
    title: 'Biochemistry, Biophysics and Molecular Biology.',
    family: '26',
    familyTitle: 'BIOLOGICAL AND BIOMEDICAL SCIENCES.',
  },
  {
    code: '26.03',
    title: 'Botany/Plant Biology.',
    family: '26',
    familyTitle: 'BIOLOGICAL AND BIOMEDICAL SCIENCES.',
  },
  {
    code: '26.04',
    title: 'Cell/Cellular Biology and Anatomical Sciences.',
    family: '26',
    familyTitle: 'BIOLOGICAL AND BIOMEDICAL SCIENCES.',
  },
  {
    code: '26.05',
    title: 'Microbiological Sciences and Immunology.',
    family: '26',
    familyTitle: 'BIOLOGICAL AND BIOMEDICAL SCIENCES.',
  },
  {
    code: '26.07',
    title: 'Zoology/Animal Biology.',
    family: '26',
    familyTitle: 'BIOLOGICAL AND BIOMEDICAL SCIENCES.',
  },
  {
    code: '26.08',
    title: 'Genetics.',
    family: '26',
    familyTitle: 'BIOLOGICAL AND BIOMEDICAL SCIENCES.',
  },
  {
    code: '26.09',
    title: 'Physiology, Pathology and Related Sciences.',
    family: '26',
    familyTitle: 'BIOLOGICAL AND BIOMEDICAL SCIENCES.',
  },
  {
    code: '26.13',
    title: 'Ecology, Evolution, Systematics, and Population Biology.',
    family: '26',
    familyTitle: 'BIOLOGICAL AND BIOMEDICAL SCIENCES.',
  },
  {
    code: '27.01',
    title: 'Mathematics.',
    family: '27',
    familyTitle: 'MATHEMATICS AND STATISTICS.',
  },
  {
    code: '27.03',
    title: 'Applied Mathematics.',
    family: '27',
    familyTitle: 'MATHEMATICS AND STATISTICS.',
  },
  {
    code: '27.05',
    title: 'Statistics.',
    family: '27',
    familyTitle: 'MATHEMATICS AND STATISTICS.',
  },
  {
    code: '29.02',
    title: 'Intelligence, Command Control and Information Operations.',
    family: '29',
    familyTitle: 'MILITARY TECHNOLOGIES AND APPLIED SCIENCES.',
  },
  {
    code: '30.00',
    title: 'Multi-/Interdisciplinary Studies, General.',
    family: '30',
    familyTitle: 'MULTI/INTERDISCIPLINARY STUDIES.',
  },
  {
    code: '30.08',
    title: 'Mathematics and Computer Science.',
    family: '30',
    familyTitle: 'MULTI/INTERDISCIPLINARY STUDIES.',
  },
  {
    code: '30.10',
    title: 'Biopsychology.',
    family: '30',
    familyTitle: 'MULTI/INTERDISCIPLINARY STUDIES.',
  },
  {
    code: '30.25',
    title: 'Cognitive Science.',
    family: '30',
    familyTitle: 'MULTI/INTERDISCIPLINARY STUDIES.',
  },
  {
    code: '30.30',
    title: 'Computational Science.',
    family: '30',
    familyTitle: 'MULTI/INTERDISCIPLINARY STUDIES.',
  },
  {
    code: '30.39',
    title: 'Economics and Computer Science.',
    family: '30',
    familyTitle: 'MULTI/INTERDISCIPLINARY STUDIES.',
  },
  {
    code: '30.70',
    title: 'Data Science.',
    family: '30',
    familyTitle: 'MULTI/INTERDISCIPLINARY STUDIES.',
  },
  {
    code: '30.71',
    title: 'Data Analytics.',
    family: '30',
    familyTitle: 'MULTI/INTERDISCIPLINARY STUDIES.',
  },
  {
    code: '31.05',
    title: 'Sports, Kinesiology, and Physical Education/Fitness.',
    family: '31',
    familyTitle: 'PARKS, RECREATION, LEISURE, FITNESS, AND KINESIOLOGY.',
  },
  {
    code: '38.01',
    title: 'Philosophy.',
    family: '38',
    familyTitle: 'PHILOSOPHY AND RELIGIOUS STUDIES.',
  },
  {
    code: '38.02',
    title: 'Religion/Religious Studies.',
    family: '38',
    familyTitle: 'PHILOSOPHY AND RELIGIOUS STUDIES.',
  },
  {
    code: '40.02',
    title: 'Astronomy and Astrophysics.',
    family: '40',
    familyTitle: 'PHYSICAL SCIENCES.',
  },
  {
    code: '40.04',
    title: 'Atmospheric Sciences and Meteorology.',
    family: '40',
    familyTitle: 'PHYSICAL SCIENCES.',
  },
  {
    code: '40.05',
    title: 'Chemistry.',
    family: '40',
    familyTitle: 'PHYSICAL SCIENCES.',
  },
  {
    code: '40.06',
    title: 'Geological and Earth Sciences/Geosciences.',
    family: '40',
    familyTitle: 'PHYSICAL SCIENCES.',
  },
  {
    code: '40.08',
    title: 'Physics.',
    family: '40',
    familyTitle: 'PHYSICAL SCIENCES.',
  },
  {
    code: '41.03',
    title: 'Physical Science Technologies/Technicians.',
    family: '41',
    familyTitle: 'SCIENCE TECHNOLOGIES/TECHNICIANS.',
  },
  {
    code: '42.01',
    title: 'Psychology, General.',
    family: '42',
    familyTitle: 'PSYCHOLOGY.',
  },
  {
    code: '42.27',
    title: 'Research and Experimental Psychology.',
    family: '42',
    familyTitle: 'PSYCHOLOGY.',
  },
  {
    code: '42.28',
    title: 'Clinical, Counseling and Applied Psychology.',
    family: '42',
    familyTitle: 'PSYCHOLOGY.',
  },
  {
    code: '43.01',
    title: 'Criminal Justice and Corrections.',
    family: '43',
    familyTitle:
      'HOMELAND SECURITY, LAW ENFORCEMENT, FIREFIGHTING AND RELATED PROTECTIVE SERVICES.',
  },
  {
    code: '43.02',
    title: 'Fire Protection.',
    family: '43',
    familyTitle:
      'HOMELAND SECURITY, LAW ENFORCEMENT, FIREFIGHTING AND RELATED PROTECTIVE SERVICES.',
  },
  {
    code: '43.03',
    title: 'Homeland Security.',
    family: '43',
    familyTitle:
      'HOMELAND SECURITY, LAW ENFORCEMENT, FIREFIGHTING AND RELATED PROTECTIVE SERVICES.',
  },
  {
    code: '43.04',
    title: 'Security Science and Technology.',
    family: '43',
    familyTitle:
      'HOMELAND SECURITY, LAW ENFORCEMENT, FIREFIGHTING AND RELATED PROTECTIVE SERVICES.',
  },
  {
    code: '44.00',
    title: 'Human Services, General.',
    family: '44',
    familyTitle: 'PUBLIC ADMINISTRATION AND SOCIAL SERVICE PROFESSIONS.',
  },
  {
    code: '44.02',
    title: 'Community Organization and Advocacy.',
    family: '44',
    familyTitle: 'PUBLIC ADMINISTRATION AND SOCIAL SERVICE PROFESSIONS.',
  },
  {
    code: '44.04',
    title: 'Public Administration.',
    family: '44',
    familyTitle: 'PUBLIC ADMINISTRATION AND SOCIAL SERVICE PROFESSIONS.',
  },
  {
    code: '44.07',
    title: 'Social Work.',
    family: '44',
    familyTitle: 'PUBLIC ADMINISTRATION AND SOCIAL SERVICE PROFESSIONS.',
  },
  {
    code: '45.01',
    title: 'Social Sciences, General.',
    family: '45',
    familyTitle: 'SOCIAL SCIENCES.',
  },
  {
    code: '45.02',
    title: 'Anthropology.',
    family: '45',
    familyTitle: 'SOCIAL SCIENCES.',
  },
  {
    code: '45.03',
    title: 'Archeology.',
    family: '45',
    familyTitle: 'SOCIAL SCIENCES.',
  },
  {
    code: '45.04',
    title: 'Criminology.',
    family: '45',
    familyTitle: 'SOCIAL SCIENCES.',
  },
  {
    code: '45.05',
    title: 'Demography.',
    family: '45',
    familyTitle: 'SOCIAL SCIENCES.',
  },
  {
    code: '45.06',
    title: 'Economics.',
    family: '45',
    familyTitle: 'SOCIAL SCIENCES.',
  },
  {
    code: '45.07',
    title: 'Geography and Cartography.',
    family: '45',
    familyTitle: 'SOCIAL SCIENCES.',
  },
  {
    code: '45.09',
    title: 'International Relations and National Security Studies.',
    family: '45',
    familyTitle: 'SOCIAL SCIENCES.',
  },
  {
    code: '45.10',
    title: 'Political Science and Government.',
    family: '45',
    familyTitle: 'SOCIAL SCIENCES.',
  },
  {
    code: '45.11',
    title: 'Sociology.',
    family: '45',
    familyTitle: 'SOCIAL SCIENCES.',
  },
  {
    code: '50.01',
    title: 'Visual and Performing Arts, General.',
    family: '50',
    familyTitle: 'VISUAL AND PERFORMING ARTS.',
  },
  {
    code: '50.02',
    title: 'Crafts/Craft Design, Folk Art and Artisanry.',
    family: '50',
    familyTitle: 'VISUAL AND PERFORMING ARTS.',
  },
  {
    code: '50.03',
    title: 'Dance.',
    family: '50',
    familyTitle: 'VISUAL AND PERFORMING ARTS.',
  },
  {
    code: '50.04',
    title: 'Design and Applied Arts.',
    family: '50',
    familyTitle: 'VISUAL AND PERFORMING ARTS.',
  },
  {
    code: '50.05',
    title: 'Drama/Theatre Arts and Stagecraft.',
    family: '50',
    familyTitle: 'VISUAL AND PERFORMING ARTS.',
  },
  {
    code: '50.06',
    title: 'Film/Video and Photographic Arts.',
    family: '50',
    familyTitle: 'VISUAL AND PERFORMING ARTS.',
  },
  {
    code: '50.07',
    title: 'Fine and Studio Arts.',
    family: '50',
    familyTitle: 'VISUAL AND PERFORMING ARTS.',
  },
  {
    code: '50.09',
    title: 'Music.',
    family: '50',
    familyTitle: 'VISUAL AND PERFORMING ARTS.',
  },
  {
    code: '50.10',
    title: 'Arts, Entertainment, and Media Management.',
    family: '50',
    familyTitle: 'VISUAL AND PERFORMING ARTS.',
  },
  {
    code: '51.00',
    title: 'Health Services/Allied Health/Health Sciences, General.',
    family: '51',
    familyTitle: 'HEALTH PROFESSIONS AND RELATED PROGRAMS.',
  },
  {
    code: '51.01',
    title: 'Chiropractic.',
    family: '51',
    familyTitle: 'HEALTH PROFESSIONS AND RELATED PROGRAMS.',
  },
  {
    code: '51.02',
    title: 'Communication Disorders Sciences and Services.',
    family: '51',
    familyTitle: 'HEALTH PROFESSIONS AND RELATED PROGRAMS.',
  },
  {
    code: '51.04',
    title: 'Dentistry.',
    family: '51',
    familyTitle: 'HEALTH PROFESSIONS AND RELATED PROGRAMS.',
  },
  {
    code: '51.05',
    title: 'Advanced/Graduate Dentistry and Oral Sciences.',
    family: '51',
    familyTitle: 'HEALTH PROFESSIONS AND RELATED PROGRAMS.',
  },
  {
    code: '51.06',
    title: 'Dental Support Services and Allied Professions.',
    family: '51',
    familyTitle: 'HEALTH PROFESSIONS AND RELATED PROGRAMS.',
  },
  {
    code: '51.07',
    title: 'Health and Medical Administrative Services.',
    family: '51',
    familyTitle: 'HEALTH PROFESSIONS AND RELATED PROGRAMS.',
  },
  {
    code: '51.08',
    title: 'Allied Health and Medical Assisting Services.',
    family: '51',
    familyTitle: 'HEALTH PROFESSIONS AND RELATED PROGRAMS.',
  },
  {
    code: '51.09',
    title: 'Allied Health Diagnostic, Intervention, and Treatment Professions.',
    family: '51',
    familyTitle: 'HEALTH PROFESSIONS AND RELATED PROGRAMS.',
  },
  {
    code: '51.10',
    title: 'Clinical/Medical Laboratory Science/Research and Allied Professions.',
    family: '51',
    familyTitle: 'HEALTH PROFESSIONS AND RELATED PROGRAMS.',
  },
  {
    code: '51.11',
    title: 'Health/Medical Preparatory Programs.',
    family: '51',
    familyTitle: 'HEALTH PROFESSIONS AND RELATED PROGRAMS.',
  },
  {
    code: '51.12',
    title: 'Medicine.',
    family: '51',
    familyTitle: 'HEALTH PROFESSIONS AND RELATED PROGRAMS.',
  },
  {
    code: '51.14',
    title: 'Medical Clinical Sciences/Graduate Medical Studies.',
    family: '51',
    familyTitle: 'HEALTH PROFESSIONS AND RELATED PROGRAMS.',
  },
  {
    code: '51.15',
    title: 'Mental and Social Health Services and Allied Professions.',
    family: '51',
    familyTitle: 'HEALTH PROFESSIONS AND RELATED PROGRAMS.',
  },
  {
    code: '51.17',
    title: 'Optometry.',
    family: '51',
    familyTitle: 'HEALTH PROFESSIONS AND RELATED PROGRAMS.',
  },
  {
    code: '51.18',
    title: 'Ophthalmic and Optometric Support Services and Allied Professions.',
    family: '51',
    familyTitle: 'HEALTH PROFESSIONS AND RELATED PROGRAMS.',
  },
  {
    code: '51.20',
    title: 'Pharmacy, Pharmaceutical Sciences, and Administration.',
    family: '51',
    familyTitle: 'HEALTH PROFESSIONS AND RELATED PROGRAMS.',
  },
  {
    code: '51.22',
    title: 'Public Health.',
    family: '51',
    familyTitle: 'HEALTH PROFESSIONS AND RELATED PROGRAMS.',
  },
  {
    code: '51.23',
    title: 'Rehabilitation and Therapeutic Professions.',
    family: '51',
    familyTitle: 'HEALTH PROFESSIONS AND RELATED PROGRAMS.',
  },
  {
    code: '51.26',
    title: 'Health Aides/Attendants/Orderlies.',
    family: '51',
    familyTitle: 'HEALTH PROFESSIONS AND RELATED PROGRAMS.',
  },
  {
    code: '51.27',
    title: 'Medical Illustration and Informatics.',
    family: '51',
    familyTitle: 'HEALTH PROFESSIONS AND RELATED PROGRAMS.',
  },
  {
    code: '51.31',
    title: 'Dietetics and Clinical Nutrition Services.',
    family: '51',
    familyTitle: 'HEALTH PROFESSIONS AND RELATED PROGRAMS.',
  },
  {
    code: '51.36',
    title: 'Movement and Mind-Body Therapies and Education.',
    family: '51',
    familyTitle: 'HEALTH PROFESSIONS AND RELATED PROGRAMS.',
  },
  {
    code: '51.37',
    title: 'Energy and Biologically Based Therapies.',
    family: '51',
    familyTitle: 'HEALTH PROFESSIONS AND RELATED PROGRAMS.',
  },
  {
    code: '51.38',
    title: 'Registered Nursing, Nursing Administration, Nursing Research and Clinical Nursing.',
    family: '51',
    familyTitle: 'HEALTH PROFESSIONS AND RELATED PROGRAMS.',
  },
  {
    code: '51.39',
    title: 'Practical Nursing, Vocational Nursing and Nursing Assistants.',
    family: '51',
    familyTitle: 'HEALTH PROFESSIONS AND RELATED PROGRAMS.',
  },
  {
    code: '52.01',
    title: 'Business/Commerce, General.',
    family: '52',
    familyTitle: 'BUSINESS, MANAGEMENT, MARKETING, AND RELATED SUPPORT SERVICES.',
  },
  {
    code: '52.02',
    title: 'Business Administration, Management and Operations.',
    family: '52',
    familyTitle: 'BUSINESS, MANAGEMENT, MARKETING, AND RELATED SUPPORT SERVICES.',
  },
  {
    code: '52.03',
    title: 'Accounting and Related Services.',
    family: '52',
    familyTitle: 'BUSINESS, MANAGEMENT, MARKETING, AND RELATED SUPPORT SERVICES.',
  },
  {
    code: '52.04',
    title: 'Business Operations Support and Assistant Services.',
    family: '52',
    familyTitle: 'BUSINESS, MANAGEMENT, MARKETING, AND RELATED SUPPORT SERVICES.',
  },
  {
    code: '52.05',
    title: 'Business/Corporate Communications.',
    family: '52',
    familyTitle: 'BUSINESS, MANAGEMENT, MARKETING, AND RELATED SUPPORT SERVICES.',
  },
  {
    code: '52.06',
    title: 'Business/Managerial Economics.',
    family: '52',
    familyTitle: 'BUSINESS, MANAGEMENT, MARKETING, AND RELATED SUPPORT SERVICES.',
  },
  {
    code: '52.07',
    title: 'Entrepreneurial and Small Business Operations.',
    family: '52',
    familyTitle: 'BUSINESS, MANAGEMENT, MARKETING, AND RELATED SUPPORT SERVICES.',
  },
  {
    code: '52.08',
    title: 'Finance and Financial Management Services.',
    family: '52',
    familyTitle: 'BUSINESS, MANAGEMENT, MARKETING, AND RELATED SUPPORT SERVICES.',
  },
  {
    code: '52.09',
    title: 'Hospitality Administration/Management.',
    family: '52',
    familyTitle: 'BUSINESS, MANAGEMENT, MARKETING, AND RELATED SUPPORT SERVICES.',
  },
  {
    code: '52.10',
    title: 'Human Resources Management and Services.',
    family: '52',
    familyTitle: 'BUSINESS, MANAGEMENT, MARKETING, AND RELATED SUPPORT SERVICES.',
  },
  {
    code: '52.11',
    title: 'International Business.',
    family: '52',
    familyTitle: 'BUSINESS, MANAGEMENT, MARKETING, AND RELATED SUPPORT SERVICES.',
  },
  {
    code: '52.12',
    title: 'Management Information Systems and Services.',
    family: '52',
    familyTitle: 'BUSINESS, MANAGEMENT, MARKETING, AND RELATED SUPPORT SERVICES.',
  },
  {
    code: '52.13',
    title: 'Management Sciences and Quantitative Methods.',
    family: '52',
    familyTitle: 'BUSINESS, MANAGEMENT, MARKETING, AND RELATED SUPPORT SERVICES.',
  },
  {
    code: '52.14',
    title: 'Marketing.',
    family: '52',
    familyTitle: 'BUSINESS, MANAGEMENT, MARKETING, AND RELATED SUPPORT SERVICES.',
  },
  {
    code: '52.15',
    title: 'Real Estate.',
    family: '52',
    familyTitle: 'BUSINESS, MANAGEMENT, MARKETING, AND RELATED SUPPORT SERVICES.',
  },
  {
    code: '52.16',
    title: 'Taxation.',
    family: '52',
    familyTitle: 'BUSINESS, MANAGEMENT, MARKETING, AND RELATED SUPPORT SERVICES.',
  },
  {
    code: '52.17',
    title: 'Insurance.',
    family: '52',
    familyTitle: 'BUSINESS, MANAGEMENT, MARKETING, AND RELATED SUPPORT SERVICES.',
  },
  {
    code: '52.18',
    title: 'General Sales, Merchandising and Related Marketing Operations.',
    family: '52',
    familyTitle: 'BUSINESS, MANAGEMENT, MARKETING, AND RELATED SUPPORT SERVICES.',
  },
  {
    code: '52.19',
    title: 'Specialized Sales, Merchandising and  Marketing Operations.',
    family: '52',
    familyTitle: 'BUSINESS, MANAGEMENT, MARKETING, AND RELATED SUPPORT SERVICES.',
  },
  {
    code: '54.01',
    title: 'History.',
    family: '54',
    familyTitle: 'HISTORY.',
  },
];

/**
 * Search CIP codes by keyword — matches against code, title, family title.
 * Returns up to `limit` results (default 20).
 */
export function searchCipCodes(query: string, limit = 20): CipEntry[] {
  if (/^\d{4}$/.test(query)) query = `${query.slice(0, 2)}.${query.slice(2)}`;
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return CIP_CODES.slice(0, limit);
  const matches: Array<{
    entry: CipEntry;
    exact: boolean;
    matchedTerms: number;
    titleTerms: number;
    codePrefix: boolean;
  }> = [];
  for (const entry of CIP_CODES) {
    const titles = [
      entry.title,
      ...(CIP_ALIASES[entry.code] ?? []).map((alias) => alias.title),
    ].map((title) => title.toLowerCase().replace(/\.$/, ''));
    const haystack = `${entry.code} ${titles.join(' ')} ${entry.familyTitle}`.toLowerCase();
    const matchedTerms = terms.filter((term) => haystack.includes(term)).length;
    if (matchedTerms > 0)
      matches.push({
        entry,
        matchedTerms,
        exact: entry.code === query || titles.includes(query.toLowerCase()),
        titleTerms: terms.filter((term) => titles.some((title) => title.includes(term))).length,
        codePrefix: entry.code.startsWith(query),
      });
  }
  return matches
    .sort(
      (a, b) =>
        Number(b.exact) - Number(a.exact) ||
        b.matchedTerms - a.matchedTerms ||
        Number(b.codePrefix) - Number(a.codePrefix) ||
        b.titleTerms - a.titleTerms,
    )
    .slice(0, limit)
    .map((s) => s.entry);
}

/** Verified six-digit descendants used only as keyword aliases for their four-digit group. */
export const CIP_ALIASES: Record<string, Array<{ code: string; title: string }>> = {
  '03.01': [{ code: '03.0103', title: 'Environmental Studies.' }],
  '03.02': [
    { code: '03.0201', title: 'Environmental/Natural Resources Management and Policy, General.' },
  ],
  '11.08': [{ code: '11.0804', title: 'Modeling, Virtual Environments and Simulation.' }],
  '13.06': [{ code: '13.0604', title: 'Educational Assessment, Testing, and Measurement.' }],
  '14.10': [{ code: '14.1001', title: 'Electrical and Electronics Engineering.' }],
  '23.13': [
    { code: '23.1303', title: 'Professional, Technical, Business, and Scientific Writing.' },
  ],
  '23.14': [
    { code: '23.1402', title: 'American Literature (United States).' },
    { code: '23.1403', title: 'American Literature (Canadian).' },
  ],
  '42.27': [
    { code: '42.2701', title: 'Cognitive Psychology and Psycholinguistics.' },
    { code: '42.2702', title: 'Comparative Psychology.' },
    { code: '42.2703', title: 'Developmental and Child Psychology.' },
  ],
  '42.28': [
    { code: '42.2802', title: 'Community Psychology.' },
    { code: '42.2810', title: 'Health/Medical Psychology.' },
    { code: '42.2812', title: 'Forensic Psychology.' },
  ],
  '43.04': [{ code: '43.0406', title: 'Forensic Science and Technology.' }],
};
