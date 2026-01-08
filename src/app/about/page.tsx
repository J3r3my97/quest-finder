import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Target, Users, Zap } from "lucide-react";

export const metadata: Metadata = {
  title: "About",
  description: "About Quest-Finder - Helping small businesses win government contracts",
};

export default function AboutPage() {
  return (
    <div className="container max-w-4xl py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">About Quest-Finder</h1>
        <p className="text-xl text-muted-foreground">
          Helping small businesses discover and win government contracts
        </p>
      </div>

      <div className="prose prose-gray dark:prose-invert max-w-none space-y-8">
        <section>
          <h2 className="text-2xl font-semibold mb-4">Our Mission</h2>
          <p className="text-lg">
            Government contracting shouldn&apos;t be overwhelming. We built Quest-Finder to help small businesses find the right opportunities without spending hours searching through multiple procurement platforms.
          </p>
        </section>

        <section className="grid md:grid-cols-3 gap-6 py-8">
          <div className="text-center p-6 rounded-lg border">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
              <Target className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Smart Matching</h3>
            <p className="text-sm text-muted-foreground">
              We match contracts to your company profile so you see opportunities you can actually win.
            </p>
          </div>

          <div className="text-center p-6 rounded-lg border">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Real-Time Alerts</h3>
            <p className="text-sm text-muted-foreground">
              Get notified when new contracts match your profile - never miss a deadline again.
            </p>
          </div>

          <div className="text-center p-6 rounded-lg border">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Built for Small Business</h3>
            <p className="text-sm text-muted-foreground">
              Designed specifically for small businesses navigating set-asides and certifications.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Data Sources</h2>
          <p>
            We aggregate contract opportunities from trusted government procurement platforms including:
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-4">
            <li><strong>SAM.gov</strong> - Federal contract opportunities</li>
            <li><strong>COMMBUYS</strong> - Massachusetts state procurement</li>
            <li><strong>Boston.gov</strong> - City of Boston bid opportunities</li>
          </ul>
          <p className="mt-4">
            Our system automatically syncs with these platforms daily to ensure you have access to the latest opportunities.
          </p>
        </section>

        <section className="text-center py-8">
          <h2 className="text-2xl font-semibold mb-4">Ready to find your next contract?</h2>
          <div className="flex gap-4 justify-center">
            <Button asChild size="lg">
              <Link href="/signup">Get Started Free</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/search">Browse Contracts</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
