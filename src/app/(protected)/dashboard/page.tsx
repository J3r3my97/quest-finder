import { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Bell, Bookmark, TrendingUp, ArrowRight, Calendar, DollarSign, Building2 } from "lucide-react";
import type { ContractLead } from "@/types";

export const metadata: Metadata = {
  title: "Dashboard",
};

// Mock data for recent contracts
const recentContracts: ContractLead[] = [
  {
    id: "1",
    title: "IT Support Services for Federal Agency",
    agency: "Department of Defense",
    estimatedValue: 2500000,
    responseDeadline: new Date("2024-03-15"),
    naicsCodes: ["541512"],
    setAsideType: "SBA",
    description: "Comprehensive IT support and managed services.",
    sourceUrl: "https://sam.gov",
    postedDate: new Date("2024-01-10"),
    source: "SAM.gov",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "2",
    title: "Cybersecurity Assessment and Consulting",
    agency: "Department of Homeland Security",
    estimatedValue: 1800000,
    responseDeadline: new Date("2024-03-20"),
    naicsCodes: ["541519"],
    setAsideType: "8A",
    description: "Security assessment and vulnerability testing.",
    sourceUrl: "https://sam.gov",
    postedDate: new Date("2024-01-12"),
    source: "SAM.gov",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "3",
    title: "Cloud Migration Services",
    agency: "General Services Administration",
    estimatedValue: 3200000,
    responseDeadline: new Date("2024-04-01"),
    naicsCodes: ["541512", "518210"],
    setAsideType: "WOSB",
    description: "AWS cloud migration and management services.",
    sourceUrl: "https://sam.gov",
    postedDate: new Date("2024-01-14"),
    source: "SAM.gov",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const stats = [
  { label: "Total Searches", value: "24", icon: Search, change: "+12%" },
  { label: "Saved Contracts", value: "8", icon: Bookmark, change: "+3" },
  { label: "Active Alerts", value: "5", icon: Bell, change: "0" },
  { label: "Matches This Week", value: "42", icon: TrendingUp, change: "+18%" },
];

function formatCurrency(value: number | null): string {
  if (!value) return "TBD";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
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
    small_business: "Small Business",
    woman_owned: "WOSB",
    veteran_owned: "VOSB",
    hubzone: "HUBZone",
    "8a": "8(a)",
    sdvosb: "SDVOSB",
    none: "Full & Open",
  };
  return type ? labels[type] || type : "Full & Open";
}

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

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
                {stat.change} from last week
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Contracts */}
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Contract Matches</CardTitle>
                  <CardDescription>
                    Based on your saved searches and preferences
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/search">View All</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentContracts.map((contract) => (
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
                      {getSetAsideLabel(contract.setAsideType ?? null)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3 text-muted-foreground" />
                      {formatCurrency(contract.estimatedValue ?? null)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      Due: {formatDate(contract.responseDeadline ?? null)}
                    </div>
                  </div>
                </div>
              ))}
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
