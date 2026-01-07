import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || process.env.quests_store_DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL or quests_store_DATABASE_URL is required');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const contractsData = [
  {
    title: 'IT Support Services for Federal Agency',
    agency: 'Department of Defense',
    subAgency: 'Defense Information Systems Agency',
    description: 'Comprehensive IT support and managed services for DOD facilities nationwide. Includes help desk support, network administration, cybersecurity monitoring, and hardware/software maintenance.',
    solicitationNumber: 'W91WAW-24-R-0001',
    noticeType: 'Combined Synopsis/Solicitation',
    contractType: 'IDIQ',
    estimatedValue: 2500000,
    naicsCodes: ['541512'],
    pscCode: 'D302',
    setAsideType: 'SBA',
    placeOfPerformance: 'Washington, DC',
    postedDate: new Date('2024-01-10'),
    responseDeadline: new Date('2024-03-15'),
    sourceUrl: 'https://sam.gov/opp/abc123',
    sourceId: 'abc123',
    source: 'SAM.gov',
  },
  {
    title: 'Cybersecurity Assessment and Consulting',
    agency: 'Department of Homeland Security',
    subAgency: 'Cybersecurity and Infrastructure Security Agency',
    description: 'Security assessment, vulnerability testing, penetration testing, and compliance consulting services for critical infrastructure systems.',
    solicitationNumber: 'HSHQDC-24-R-00015',
    noticeType: 'Combined Synopsis/Solicitation',
    contractType: 'Firm Fixed Price',
    estimatedValue: 1800000,
    naicsCodes: ['541519'],
    pscCode: 'D310',
    setAsideType: '8A',
    placeOfPerformance: 'Arlington, VA',
    postedDate: new Date('2024-01-12'),
    responseDeadline: new Date('2024-03-20'),
    sourceUrl: 'https://sam.gov/opp/def456',
    sourceId: 'def456',
    source: 'SAM.gov',
  },
  {
    title: 'Cloud Migration Services',
    agency: 'General Services Administration',
    subAgency: 'Technology Transformation Services',
    description: 'AWS cloud migration and management services for federal systems. Includes assessment, migration planning, execution, and ongoing managed services.',
    solicitationNumber: 'GS-35F-0001',
    noticeType: 'Combined Synopsis/Solicitation',
    contractType: 'Time and Materials',
    estimatedValue: 3200000,
    naicsCodes: ['541512', '518210'],
    pscCode: 'D307',
    setAsideType: 'WOSB',
    placeOfPerformance: 'Remote',
    postedDate: new Date('2024-01-14'),
    responseDeadline: new Date('2024-04-01'),
    sourceUrl: 'https://sam.gov/opp/ghi789',
    sourceId: 'ghi789',
    source: 'SAM.gov',
  },
  {
    title: 'Software Development Services',
    agency: 'Department of Veterans Affairs',
    subAgency: 'Office of Information and Technology',
    description: 'Custom software development and maintenance for VA healthcare systems. Agile development, DevSecOps, and continuous integration/deployment.',
    solicitationNumber: 'VA118-24-R-0100',
    noticeType: 'Combined Synopsis/Solicitation',
    contractType: 'IDIQ',
    estimatedValue: 4500000,
    naicsCodes: ['541511'],
    pscCode: 'D301',
    setAsideType: 'SDVOSBC',
    placeOfPerformance: 'Multiple Locations',
    postedDate: new Date('2024-01-15'),
    responseDeadline: new Date('2024-04-15'),
    sourceUrl: 'https://sam.gov/opp/jkl012',
    sourceId: 'jkl012',
    source: 'SAM.gov',
  },
  {
    title: 'Data Analytics Platform',
    agency: 'Department of Commerce',
    subAgency: 'Bureau of Economic Analysis',
    description: 'Enterprise data analytics platform implementation and support. Includes data warehousing, business intelligence, and machine learning capabilities.',
    solicitationNumber: 'DOC-24-0050',
    noticeType: 'Combined Synopsis/Solicitation',
    contractType: 'Firm Fixed Price',
    estimatedValue: 2100000,
    naicsCodes: ['541512', '518210'],
    pscCode: 'D308',
    setAsideType: null,
    placeOfPerformance: 'Suitland, MD',
    postedDate: new Date('2024-01-16'),
    responseDeadline: new Date('2024-03-25'),
    sourceUrl: 'https://sam.gov/opp/mno345',
    sourceId: 'mno345',
    source: 'SAM.gov',
  },
  {
    title: 'Network Infrastructure Modernization',
    agency: 'Department of the Treasury',
    subAgency: 'Internal Revenue Service',
    description: 'Network infrastructure upgrade and modernization across IRS facilities. Includes network design, equipment procurement, installation, and support.',
    solicitationNumber: 'TIRNO-24-R-00008',
    noticeType: 'Presolicitation',
    contractType: 'IDIQ',
    estimatedValue: 8500000,
    naicsCodes: ['541512', '541513'],
    pscCode: 'D304',
    setAsideType: 'HZC',
    placeOfPerformance: 'Nationwide',
    postedDate: new Date('2024-01-18'),
    responseDeadline: new Date('2024-05-01'),
    sourceUrl: 'https://sam.gov/opp/pqr678',
    sourceId: 'pqr678',
    source: 'SAM.gov',
  },
  {
    title: 'Mobile Application Development',
    agency: 'Department of Health and Human Services',
    subAgency: 'Centers for Disease Control and Prevention',
    description: 'Mobile application development for public health initiatives. iOS and Android development with backend API integration.',
    solicitationNumber: 'HHS-CDC-24-0200',
    noticeType: 'Sources Sought',
    contractType: 'Time and Materials',
    estimatedValue: 1200000,
    naicsCodes: ['541511'],
    pscCode: 'D301',
    setAsideType: 'SBA',
    placeOfPerformance: 'Atlanta, GA',
    postedDate: new Date('2024-01-20'),
    responseDeadline: new Date('2024-02-28'),
    sourceUrl: 'https://sam.gov/opp/stu901',
    sourceId: 'stu901',
    source: 'SAM.gov',
  },
  {
    title: 'Enterprise Resource Planning Implementation',
    agency: 'Department of Education',
    subAgency: 'Office of the Chief Information Officer',
    description: 'ERP system implementation including financial management, human resources, and procurement modules. Training and change management included.',
    solicitationNumber: 'ED-24-R-0015',
    noticeType: 'Combined Synopsis/Solicitation',
    contractType: 'Firm Fixed Price',
    estimatedValue: 6800000,
    naicsCodes: ['541512', '541611'],
    pscCode: 'D302',
    setAsideType: '8A',
    placeOfPerformance: 'Washington, DC',
    postedDate: new Date('2024-01-22'),
    responseDeadline: new Date('2024-04-30'),
    sourceUrl: 'https://sam.gov/opp/vwx234',
    sourceId: 'vwx234',
    source: 'SAM.gov',
  },
  {
    title: 'Help Desk and End User Support',
    agency: 'Department of Justice',
    subAgency: 'Federal Bureau of Investigation',
    description: 'Tier 1-3 help desk support for FBI field offices nationwide. 24/7 coverage with escalation procedures and SLA requirements.',
    solicitationNumber: 'DJF-24-R-0080',
    noticeType: 'Combined Synopsis/Solicitation',
    contractType: 'IDIQ',
    estimatedValue: 3500000,
    naicsCodes: ['541512'],
    pscCode: 'D302',
    setAsideType: 'SDVOSBS',
    placeOfPerformance: 'Nationwide',
    postedDate: new Date('2024-01-25'),
    responseDeadline: new Date('2024-04-10'),
    sourceUrl: 'https://sam.gov/opp/yza567',
    sourceId: 'yza567',
    source: 'SAM.gov',
  },
  {
    title: 'Artificial Intelligence Research and Development',
    agency: 'Department of Defense',
    subAgency: 'Defense Advanced Research Projects Agency',
    description: 'AI/ML research and development for defense applications. Includes natural language processing, computer vision, and autonomous systems.',
    solicitationNumber: 'DARPA-24-BAA-001',
    noticeType: 'Special Notice',
    contractType: 'Cost Plus Fixed Fee',
    estimatedValue: 15000000,
    naicsCodes: ['541715', '541512'],
    pscCode: 'AC11',
    setAsideType: null,
    placeOfPerformance: 'Arlington, VA',
    postedDate: new Date('2024-01-28'),
    responseDeadline: new Date('2024-06-30'),
    sourceUrl: 'https://sam.gov/opp/bcd890',
    sourceId: 'bcd890',
    source: 'SAM.gov',
  },
];

async function main() {
  console.log('Starting seed...');

  // Clear existing contracts
  await prisma.contractLead.deleteMany();
  console.log('Cleared existing contracts');

  // Insert contracts
  for (const contract of contractsData) {
    await prisma.contractLead.create({
      data: contract,
    });
  }

  console.log(`Seeded ${contractsData.length} contracts`);

  // Create a demo user
  const existingUser = await prisma.user.findUnique({
    where: { email: 'demo@questfinder.com' },
  });

  if (!existingUser) {
    await prisma.user.create({
      data: {
        email: 'demo@questfinder.com',
        name: 'Demo User',
        subscriptionTier: 'PRO',
      },
    });
    console.log('Created demo user');
  }

  console.log('Seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
