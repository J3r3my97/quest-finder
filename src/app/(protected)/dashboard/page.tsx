import { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Bell, Bookmark, TrendingUp, ArrowRight, Calendar, DollarSign, Building2, Sparkles, Target } from "lucide-react";
import { scoreAndSortContracts } from "@/services/match-scoring";
import { ContractLead, CompanyProfile } from "@/types";

export const metadata: Metadata = {
  title: "Dashboard",
};

function formatCurrency(value: unknown): string {
  if (!value) return "TBD";
  const numValue = typeof value === "string" ? parseFloat(value) :
                   typeof value === "bigint" ? Number(value) :
                   typeof value === "number" ? value :
                   Number(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(numValue);
}

function formatDate(date: Date | null): string {
  if (!date) return "TBD";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getSetAsideLabel(type: string | null): string {
  const labels: Record<string, string> = {
    SBA: "Small Business",
    SBP: "Small Business",
    "8A": "8(a)",
    "8AN": "8(a)",
    WOSB: "WOSB",
    WOSBSS: "WOSB",
    EDWOSB: "EDWOSB",
    SDVOSBC: "SDVOSB",
    SDVOSBS: "SDVOSB",
    HZC: "HUBZone",
    HZS: "HUBZone",
  };
  return type ? labels[type] || type : "Full & Open";
}

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Fetch user's company profile
  const companyProfile = await prisma.companyProfile.findUnique({
    where: { userId: session.user.id },
  });

  // Fetch recent contracts from database
  const recentContracts = await prisma.contractLead.findMany({
    orderBy: { postedDate: "desc" },
    take: 5,
  });

  // Get matched contracts if profile exists
  let matchedContracts: Array<{ contract: ContractLead; matchScore: number; matchReasons: string[] }> = [];
  if (companyProfile) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const contractsForMatching = await prisma.contractLead.findMany({
      where: {
        postedDate: { gte: thirtyDaysAgo },
        OR: [
          { responseDeadline: null },
          { responseDeadline: { gte: new Date() } },
        ],
      },
      orderBy: { postedDate: "desc" },
      take: 100,
    });

    const profileForScoring: CompanyProfile = {
      id: companyProfile.id,
      userId: companyProfile.userId,
      companyName: companyProfile.companyName,
      naicsCodes: companyProfile.naicsCodes,
      certifications: companyProfile.certifications,
      preferredStates: companyProfile.preferredStates,
      minContractValue: companyProfile.minContractValue
        ? Number(companyProfile.minContractValue)
        : null,
      maxContractValue: companyProfile.maxContractValue
        ? Number(companyProfile.maxContractValue)
        : null,
      createdAt: companyProfile.createdAt,
      updatedAt: companyProfile.updatedAt,
    };

    const contractsTyped: ContractLead[] = contractsForMatching.map((c) => ({
      ...c,
      estimatedValue: c.estimatedValue ? Number(c.estimatedValue) : null,
      awardAmount: c.awardAmount ? Number(c.awardAmount) : null,
    }));

    matchedContracts = scoreAndSortContracts(contractsTyped, profileForScoring, 30).slice(0, 5);
  }

  // Fetch stats
  const totalContracts = await prisma.contractLead.count();
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const contractsThisWeek = await prisma.contractLead.count({
    where: {
      createdAt: {
        gte: oneWeekAgo,
      },
    },
  });

  const stats = [
    { label: "Total Contracts", value: totalContracts.toString(), icon: Search, change: "in database" },
    { label: "Saved Contracts", value: "0", icon: Bookmark, change: "coming soon" },
    { label: "Active Alerts", value: "0", icon: Bell, change: "coming soon" },
    { label: "New This Week", value: contractsThisWeek.toString(), icon: TrendingUp, change: "contracts" },
  ];

  return (
    <div className="container py-8">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back{session.user.name ? `, ${session.user.name}` : ""}
        </h1>
        <p className="text-muted-foreground mt-1">
          Here&apos;s what&apos;s happening with your contract searches
        </p>
      </div>

      {/* Quick Search */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <form className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Quick search contracts (keywords, NAICS, agency...)"
                className="pl-10"
              />
            </div>
            <Button type="submit" asChild>
              <Link href="/search">
                Search
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.change}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* For You Section */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              <div>
                <CardTitle>For You</CardTitle>
                <CardDescription>
                  {companyProfile
                    ? "Contracts matched to your company profile"
                    : "Complete your profile to see personalized matches"}
                </CardDescription>
              </div>
            </div>
            {companyProfile && matchedContracts.length > 0 && (
              <Badge variant="secondary">{matchedContracts.length} matches</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!companyProfile ? (
            <div className="text-center py-6">
              <Target className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-medium mb-2">Get personalized matches</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                Tell us about your business to see contracts matched to your capabilities.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button asChild>
                  <Link href="/profile">
                    Complete Profile
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="ghost" asChild>
                  <Link href="/search">Browse all contracts</Link>
                </Button>
              </div>
            </div>
          ) : matchedContracts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No matching contracts found. Try expanding your profile criteria.</p>
              <Button variant="outline" className="mt-4" asChild>
                <Link href="/profile">Update Profile</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {matchedContracts.map(({ contract, matchScore, matchReasons }) => (
                <div
                  key={contract.id}
                  className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/contracts/${contract.id}`}
                        className="font-medium hover:underline"
                      >
                        {contract.title}
                      </Link>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Building2 className="h-3 w-3" />
                      {contract.agency}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {matchReasons.map((reason, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {reason}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="flex items-center gap-1 justify-end">
                      <span className="text-2xl font-bold">{matchScore}</span>
                      <span className="text-xs text-muted-foreground">/ 100</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Match Score</p>
                  </div>
                </div>
              ))}
              <div className="pt-2">
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/search">View All Matches</Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Contracts */}
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Contracts</CardTitle>
                  <CardDescription>
                    Latest government contract opportunities
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/search">View All</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentContracts.length > 0 ? (
                recentContracts.map((contract) => (
                  <div
                    key={contract.id}
                    className="flex flex-col space-y-2 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <Link
                          href={`/contracts/${contract.id}`}
                          className="font-medium hover:underline"
                        >
                          {contract.title}
                        </Link>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          {contract.agency}
                        </div>
                      </div>
                      <Badge variant="secondary">
                        {getSetAsideLabel(contract.setAsideType)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-muted-foreground" />
                        {formatCurrency(contract.estimatedValue)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        Due: {formatDate(contract.responseDeadline)}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No contracts found. Run the seed script to add sample data.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/search">
                  <Search className="mr-2 h-4 w-4" />
                  New Search
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/saved-searches">
                  <Bookmark className="mr-2 h-4 w-4" />
                  Saved Searches
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/profile">
                  <Bell className="mr-2 h-4 w-4" />
                  Manage Alerts
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Subscription</CardTitle>
              <CardDescription>Current plan: Free</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Upgrade to Pro for unlimited searches, real-time alerts, and advanced filters.
              </p>
              <Button className="w-full" asChild>
                <Link href="/pricing">Upgrade to Pro</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
