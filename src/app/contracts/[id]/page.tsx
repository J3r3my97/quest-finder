import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
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
  MapPin,
  Hash,
} from "lucide-react";

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const contract = await prisma.contractLead.findUnique({
    where: { id },
  });
  if (!contract) {
    return { title: "Contract Not Found" };
  }
  return {
    title: contract.title,
    description: contract.description || undefined,
  };
}

function formatCurrency(value: unknown): string {
  if (!value) return "TBD";
  const numValue = typeof value === "string" ? parseFloat(value) :
                   typeof value === "bigint" ? Number(value) :
                   typeof value === "number" ? value :
                   Number(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(numValue);
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
    SBA: "Small Business Set-Aside",
    SBP: "Small Business Set-Aside",
    "8A": "8(a) Set-Aside",
    "8AN": "8(a) Set-Aside",
    WOSB: "Women-Owned Small Business (WOSB)",
    WOSBSS: "Women-Owned Small Business (WOSB)",
    EDWOSB: "Economically Disadvantaged WOSB",
    SDVOSBC: "Service-Disabled Veteran-Owned (SDVOSB)",
    SDVOSBS: "Service-Disabled Veteran-Owned (SDVOSB)",
    HZC: "HUBZone Set-Aside",
    HZS: "HUBZone Set-Aside",
  };
  return type ? labels[type] || type : "Full & Open Competition";
}

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contract = await prisma.contractLead.findUnique({
    where: { id },
  });

  if (!contract) {
    notFound();
  }

  // Fetch related contracts (same agency or NAICS codes)
  const relatedContracts = await prisma.contractLead.findMany({
    where: {
      id: { not: contract.id },
      OR: [
        { agency: contract.agency },
        { naicsCodes: { hasSome: contract.naicsCodes } },
      ],
    },
    take: 3,
    orderBy: { postedDate: "desc" },
  });

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
              {contract.subAgency && (
                <span className="text-sm">• {contract.subAgency}</span>
              )}
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
                <p className="text-2xl font-bold">{formatCurrency(contract.estimatedValue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm">Response Deadline</span>
                </div>
                <p className="text-2xl font-bold">{formatDate(contract.responseDeadline)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm">Posted Date</span>
                </div>
                <p className="text-2xl font-bold">{formatDate(contract.postedDate)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Additional Info */}
          <div className="grid gap-4 sm:grid-cols-2">
            {contract.solicitationNumber && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Hash className="h-4 w-4" />
                    <span className="text-sm">Solicitation Number</span>
                  </div>
                  <p className="font-medium">{contract.solicitationNumber}</p>
                </CardContent>
              </Card>
            )}
            {contract.placeOfPerformance && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <MapPin className="h-4 w-4" />
                    <span className="text-sm">Place of Performance</span>
                  </div>
                  <p className="font-medium">{contract.placeOfPerformance}</p>
                </CardContent>
              </Card>
            )}
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
                {contract.pscCode && (
                  <Badge variant="outline" className="text-sm">
                    PSC: {contract.pscCode}
                  </Badge>
                )}
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
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {contract.description || "No description available."}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Contract Details */}
          {(contract.noticeType || contract.contractType) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contract Details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                {contract.noticeType && (
                  <div>
                    <p className="text-sm text-muted-foreground">Notice Type</p>
                    <p className="font-medium">{contract.noticeType}</p>
                  </div>
                )}
                {contract.contractType && (
                  <div>
                    <p className="text-sm text-muted-foreground">Contract Type</p>
                    <p className="font-medium">{contract.contractType}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {contract.sourceUrl && (
                <Button className="w-full" asChild>
                  <a href={contract.sourceUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View on {contract.source}
                  </a>
                </Button>
              )}
              <Button variant="outline" className="w-full">
                <Bell className="mr-2 h-4 w-4" />
                Set Alert for Similar
              </Button>
            </CardContent>
          </Card>

          {/* Related Contracts */}
          {relatedContracts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Related Opportunities</CardTitle>
                <CardDescription>Similar contracts you may be interested in</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {relatedContracts.map((related) => (
                  <Link
                    key={related.id}
                    href={`/contracts/${related.id}`}
                    className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <p className="font-medium text-sm line-clamp-2">
                      {related.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {related.agency} • {formatCurrency(related.estimatedValue)}
                    </p>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
