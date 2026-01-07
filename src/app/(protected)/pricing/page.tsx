"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Check, Sparkles } from "lucide-react";

const plans = [
  {
    id: "FREE",
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Get started with basic contract search",
    features: [
      "10 searches per day",
      "3 saved searches",
      "Basic filters",
      "Email support",
    ],
    limitations: ["No alerts", "No API access"],
  },
  {
    id: "BASIC",
    name: "Basic",
    price: "$29",
    period: "/month",
    description: "For individuals tracking opportunities",
    features: [
      "100 searches per day",
      "10 saved searches",
      "Contract alerts",
      "Advanced filters",
      "Priority email support",
    ],
    limitations: ["No API access"],
    popular: false,
  },
  {
    id: "PRO",
    name: "Pro",
    price: "$79",
    period: "/month",
    description: "For teams and power users",
    features: [
      "Unlimited searches",
      "25 saved searches",
      "Real-time alerts",
      "API access",
      "Advanced analytics",
      "Phone support",
    ],
    limitations: [],
    popular: true,
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    price: "$199",
    period: "/month",
    description: "For organizations needing full access",
    features: [
      "Everything in Pro",
      "Unlimited saved searches",
      "Custom integrations",
      "Dedicated account manager",
      "SLA guarantee",
      "Team management",
    ],
    limitations: [],
  },
];

export default function PricingPage() {
  const { data: session } = useSession();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleSubscribe = async (planId: string) => {
    if (!session) {
      toast.error("Please sign in to subscribe");
      return;
    }

    if (planId === "FREE") {
      toast.info("You're already on the free plan");
      return;
    }

    setLoadingPlan(planId);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: planId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="container py-8 max-w-6xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          Simple, Transparent Pricing
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Choose the plan that fits your needs. Upgrade or downgrade anytime.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={`relative flex flex-col ${
              plan.popular ? "border-primary shadow-lg" : ""
            }`}
          >
            {plan.popular && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Sparkles className="h-3 w-3 mr-1" />
                Most Popular
              </Badge>
            )}
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow">
              <div className="mb-6">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
              </div>

              <ul className="space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
                {plan.limitations.map((limitation) => (
                  <li
                    key={limitation}
                    className="flex items-start gap-2 text-muted-foreground"
                  >
                    <span className="h-4 w-4 flex items-center justify-center mt-0.5 flex-shrink-0">
                      -
                    </span>
                    <span className="text-sm">{limitation}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                variant={plan.popular ? "default" : "outline"}
                onClick={() => handleSubscribe(plan.id)}
                disabled={loadingPlan === plan.id}
              >
                {loadingPlan === plan.id && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {plan.id === "FREE" ? "Current Plan" : "Subscribe"}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="mt-12 text-center text-sm text-muted-foreground">
        <p>All plans include a 14-day free trial. Cancel anytime.</p>
        <p className="mt-2">
          Need a custom plan?{" "}
          <a href="mailto:sales@questfinder.com" className="underline">
            Contact sales
          </a>
        </p>
      </div>
    </div>
  );
}
