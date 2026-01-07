import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  Building2,
  ExternalLink,
  Bookmark,
  Bell,
  Share2,
  FileText,
} from "lucide-react";
import type { ContractLead } from "@/types";

// Extended type for contract detail
interface ContractDetail extends ContractLead {
  fullDescription: string;
  contactInfo: { name: string; email: string; phone: string };
}

// Mock data for contract details
const mockContracts: Record<string, ContractDetail> = {
  "1": {
    id: "1",
    title: "IT Support Services for Federal Agency",
    agency: "Department of Defense",
    estimatedValue: 2500000,
    responseDeadline: new Date("2024-03-15"),
    naicsCodes: ["541512"],
    setAsideType: "SBA",
    description: "Comprehensive IT support and managed services for DOD facilities nationwide.",
    fullDescription: `The Department of Defense is seeking qualified contractors to provide comprehensive IT support and managed services across DOD facilities nationwide.

**Scope of Work:**
- Help desk and end-user support services
- Network administration and monitoring
- Cybersecurity incident response
- Hardware and software maintenance
- Cloud infrastructure management

**Requirements:**
- Active Secret clearance required for key personnel
- Demonstrated experience with federal IT environments
- Compliance with NIST 800-171 standards
- Minimum 5 years of experience in similar contracts

**Period of Performance:**
- Base year plus four option years
- Expected start date: June 1, 2024`,
    sourceUrl: "https://sam.gov/opp/1",
    postedDate: new Date("2024-01-10"),
    source: "SAM.gov",
    createdAt: new Date(),
    updatedAt: new Date(),
    contactInfo: {
      name: "John Smith",
      email: "john.smith@dod.gov",
      phone: "(555) 123-4567",
    },
  },
  "2": {
    id: "2",
    title: "Cybersecurity Assessment and Consulting",
    agency: "Department of Homeland Security",
    estimatedValue: 1800000,
    responseDeadline: new Date("2024-03-20"),
    naicsCodes: ["541519"],
    setAsideType: "8A",
    description: "Security assessment, vulnerability testing, and compliance consulting services.",
    fullDescription: `DHS requires cybersecurity assessment and consulting services to evaluate and enhance the security posture of critical infrastructure systems.

**Scope of Work:**
- Vulnerability assessments and penetration testing
- Security compliance audits (FISMA, FedRAMP)
- Risk assessment and mitigation planning
- Security awareness training development
- Incident response planning

**Requirements:**
- Top Secret clearance for project lead
- CISSP, CISM, or equivalent certifications
- Experience with federal security frameworks
- Proven track record in federal cybersecurity

**Deliverables:**
- Comprehensive security assessment reports
- Risk mitigation roadmap
- Security policy recommendations`,
    sourceUrl: "https://sam.gov/opp/2",
    postedDate: new Date("2024-01-12"),
    source: "SAM.gov",
    createdAt: new Date(),
    updatedAt: new Date(),
    contactInfo: {
      name: "Sarah Johnson",
      email: "sarah.johnson@dhs.gov",
      phone: "(555) 234-5678",
    },
  },
};

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const contract = mockContracts[id];
  if (!contract) {
    return { title: "Contract Not Found" };
  }
  return {
    title: contract.title,
    description: contract.description,
  };
}

function formatCurrency(value: number | null): string {
  if (!value) return "TBD";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatDate(date: Date | null): string {
  if (!date) return "TBD";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getSetAsideLabel(type: string | null | undefined): string {
  const labels: Record<string, string> = {
    small_business: "Small Business Set-Aside",
    woman_owned: "Women-Owned Small Business (WOSB)",
    veteran_owned: "Veteran-Owned Small Business (VOSB)",
    hubzone: "HUBZone Set-Aside",
    "8a": "8(a) Set-Aside",
    sdvosb: "Service-Disabled Veteran-Owned (SDVOSB)",
    none: "Full & Open Competition",
  };
  return type ? labels[type] || type : "Full & Open Competition";
}

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contract = mockContracts[id];

  if (!contract) {
    notFound();
  }

  return (
    <div className="container py-8">
      {/* Back Button */}
      <Link
        href="/search"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Search
      </Link>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div>
            <div className="flex items-start justify-between gap-4 mb-4">
              <Badge variant="secondary" className="text-sm">
                {getSetAsideLabel(contract.setAsideType)}
              </Badge>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Bookmark className="mr-2 h-4 w-4" />
                  Save
                </Button>
                <Button variant="outline" size="sm">
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </Button>
              </div>
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">
              {contract.title}
            </h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-5 w-5" />
              <span className="text-lg">{contract.agency}</span>
            </div>
          </div>

          {/* Key Details */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-sm">Estimated Value</span>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(contract.estimatedValue ?? null)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm">Response Deadline</span>
                </div>
                <p className="text-2xl font-bold">{formatDate(contract.responseDeadline ?? null)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm">Posted Date</span>
                </div>
                <p className="text-2xl font-bold">{formatDate(contract.postedDate ?? null)}</p>
              </CardContent>
            </Card>
          </div>

          {/* NAICS Codes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">NAICS Codes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {contract.naicsCodes.map((code) => (
                  <Badge key={code} variant="outline" className="text-sm">
                    {code}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                  {contract.fullDescription}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" asChild>
                <a href={contract.sourceUrl ?? undefined} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View on SAM.gov
                </a>
              </Button>
              <Button variant="outline" className="w-full">
                <Bell className="mr-2 h-4 w-4" />
                Set Alert for Similar
              </Button>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contact Information</CardTitle>
              <CardDescription>Primary point of contact</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{contract.contactInfo.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <a
                  href={`mailto:${contract.contactInfo.email}`}
                  className="font-medium text-primary hover:underline"
                >
                  {contract.contactInfo.email}
                </a>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <a
                  href={`tel:${contract.contactInfo.phone}`}
                  className="font-medium text-primary hover:underline"
                >
                  {contract.contactInfo.phone}
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Related Contracts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Related Opportunities</CardTitle>
              <CardDescription>Similar contracts you may be interested in</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link
                href="/contracts/2"
                className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <p className="font-medium text-sm line-clamp-2">
                  Cybersecurity Assessment and Consulting
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  DHS • $1.8M
                </p>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
