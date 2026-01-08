import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Bell, Filter, BarChart3, Shield, Zap, ArrowRight } from "lucide-react";

const features = [
  {
    icon: Search,
    title: "Smart Search",
    description:
      "Search across federal procurement platforms with powerful filters for NAICS codes, set-asides, and more.",
  },
  {
    icon: Bell,
    title: "Real-time Alerts",
    description:
      "Get notified instantly when new contracts match your criteria. Never miss an opportunity.",
  },
  {
    icon: Filter,
    title: "Advanced Filters",
    description:
      "Filter by agency, contract value, deadline, set-aside type, and geographic location.",
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    description:
      "Track your saved searches, monitor trends, and analyze contract opportunities over time.",
  },
  {
    icon: Shield,
    title: "Set-Aside Support",
    description:
      "Easily find small business, woman-owned, veteran-owned, HUBZone, and 8(a) contracts.",
  },
  {
    icon: Zap,
    title: "Fast & Reliable",
    description:
      "Built for speed with cached data and optimized queries. Find contracts in seconds.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 to-background py-20 md:py-32">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Find Government Contracts{" "}
              <span className="text-primary">Faster</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground md:text-xl">
              Quest-Finder helps you discover and track government contract
              opportunities from SAM.gov and other federal procurement
              platforms. Win more contracts with less effort.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/signup">
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/search">Try Demo Search</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 md:py-32">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need to win contracts
            </h2>
            <p className="mt-4 text-muted-foreground">
              Powerful tools designed specifically for government contractors
            </p>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="border-2 hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="mt-4">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t bg-primary py-20 text-primary-foreground">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to find your next contract?
            </h2>
            <p className="mt-4 text-primary-foreground/80">
              Quest-Finder helps you discover government contract opportunities
              matched to your business profile.
            </p>
            <div className="mt-10">
              <Button size="lg" variant="secondary" asChild>
                <Link href="/signup">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
