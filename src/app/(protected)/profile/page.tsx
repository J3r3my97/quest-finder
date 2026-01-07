"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, User, Shield, CreditCard, Bell, ExternalLink, Building2, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { CERTIFICATION_TYPES, US_STATES, CompanyProfile } from "@/types";

interface SubscriptionData {
  tier: string;
  features: {
    searchesPerDay: number;
    savedSearches: number;
    alerts: boolean;
    apiAccess: boolean;
  };
  subscriptionId: string | null;
  currentPeriodEnd: string | null;
  isActive: boolean;
}

// Common NAICS codes for government contracting
const COMMON_NAICS = [
  { code: "541511", name: "Custom Computer Programming" },
  { code: "541512", name: "Computer Systems Design" },
  { code: "541519", name: "Other Computer Related Services" },
  { code: "541611", name: "Administrative Management Consulting" },
  { code: "541612", name: "Human Resources Consulting" },
  { code: "541618", name: "Other Management Consulting" },
  { code: "541690", name: "Other Scientific & Technical Consulting" },
  { code: "541990", name: "All Other Professional Services" },
  { code: "561110", name: "Office Administrative Services" },
  { code: "561210", name: "Facilities Support Services" },
  { code: "561320", name: "Temporary Help Services" },
  { code: "236220", name: "Commercial Building Construction" },
  { code: "238210", name: "Electrical Contractors" },
  { code: "238220", name: "Plumbing & HVAC Contractors" },
  { code: "423430", name: "Computer Equipment Wholesalers" },
  { code: "518210", name: "Data Processing & Hosting" },
];

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const [isUpdating, setIsUpdating] = useState(false);
  const [name, setName] = useState(session?.user?.name || "");
  const [email, setEmail] = useState(session?.user?.email || "");
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  const [openingPortal, setOpeningPortal] = useState(false);

  // Company profile state
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [selectedNaics, setSelectedNaics] = useState<string[]>([]);
  const [selectedCerts, setSelectedCerts] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch subscription
        const subResponse = await fetch("/api/stripe/subscription");
        if (subResponse.ok) {
          const data = await subResponse.json();
          setSubscription(data);
        }

        // Fetch company profile
        const profileResponse = await fetch("/api/company-profile");
        if (profileResponse.ok) {
          const profile = await profileResponse.json();
          if (profile) {
            setCompanyProfile(profile);
            setCompanyName(profile.companyName || "");
            setSelectedNaics(profile.naicsCodes || []);
            setSelectedCerts(profile.certifications || []);
            setSelectedStates(profile.preferredStates || []);
            setMinValue(profile.minContractValue?.toString() || "");
            setMaxValue(profile.maxContractValue?.toString() || "");
          }
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoadingSubscription(false);
        setLoadingProfile(false);
      }
    };

    if (session) {
      fetchData();
    }
  }, [session]);

  const handleSaveCompanyProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);

    try {
      const response = await fetch("/api/company-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          naicsCodes: selectedNaics,
          certifications: selectedCerts,
          preferredStates: selectedStates,
          minContractValue: minValue ? parseFloat(minValue) : null,
          maxContractValue: maxValue ? parseFloat(maxValue) : null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save profile");
      }

      const profile = await response.json();
      setCompanyProfile(profile);
      toast.success("Company profile saved successfully");
    } catch (error) {
      toast.error("Failed to save company profile");
      console.error(error);
    } finally {
      setSavingProfile(false);
    }
  };

  const toggleNaics = (code: string) => {
    setSelectedNaics((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const toggleCert = (code: string) => {
    setSelectedCerts((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const toggleState = (code: string) => {
    setSelectedStates((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleOpenBillingPortal = async () => {
    setOpeningPortal(true);
    try {
      const response = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to open billing portal");
      }

      window.location.href = data.url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
      setOpeningPortal(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await update({ name });
    toast.success("Profile updated successfully");
    setIsUpdating(false);
  };

  const handleSignOut = () => {
    signOut({ callbackUrl: "/" });
  };

  return (
    <div className="container py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="grid gap-6">
        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Information
            </CardTitle>
            <CardDescription>
              Update your personal information
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleUpdateProfile}>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <Avatar className="h-20 w-20">
                  <AvatarFallback className="text-2xl">
                    {session?.user?.name?.[0]?.toUpperCase() ||
                      session?.user?.email?.[0]?.toUpperCase() ||
                      "U"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <Button type="button" variant="outline" size="sm">
                    Change Avatar
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">
                    JPG, GIF or PNG. Max 1MB.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">
                    Contact support to change your email
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isUpdating}>
                {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Company Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Company Profile
              {companyProfile && (
                <Badge variant="outline" className="ml-2">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Complete
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Tell us about your business to get matched contracts
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSaveCompanyProfile}>
            <CardContent className="space-y-6">
              {loadingProfile ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <>
                  {/* Company Name */}
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name *</Label>
                    <Input
                      id="companyName"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Your company name"
                      required
                    />
                  </div>

                  {/* NAICS Codes */}
                  <div className="space-y-2">
                    <Label>NAICS Codes (Industries You Work In)</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Select all that apply to your business
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2 max-h-48 overflow-y-auto border rounded-md p-3">
                      {COMMON_NAICS.map((naics) => (
                        <label
                          key={naics.code}
                          className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-1 rounded"
                        >
                          <Checkbox
                            checked={selectedNaics.includes(naics.code)}
                            onCheckedChange={() => toggleNaics(naics.code)}
                          />
                          <span className="font-mono text-xs">{naics.code}</span>
                          <span className="truncate">{naics.name}</span>
                        </label>
                      ))}
                    </div>
                    {selectedNaics.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {selectedNaics.length} selected
                      </p>
                    )}
                  </div>

                  {/* Certifications */}
                  <div className="space-y-2">
                    <Label>Certifications (Set-Aside Eligibility)</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Select certifications your business holds
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {CERTIFICATION_TYPES.map((cert) => (
                        <label
                          key={cert.code}
                          className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-2 rounded border"
                        >
                          <Checkbox
                            checked={selectedCerts.includes(cert.code)}
                            onCheckedChange={() => toggleCert(cert.code)}
                          />
                          <span>{cert.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Preferred States */}
                  <div className="space-y-2">
                    <Label>Preferred States (Where You Can Work)</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Select states where you can perform contract work
                    </p>
                    <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto border rounded-md p-3">
                      {US_STATES.map((state) => (
                        <Badge
                          key={state.code}
                          variant={selectedStates.includes(state.code) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => toggleState(state.code)}
                        >
                          {state.code}
                        </Badge>
                      ))}
                    </div>
                    {selectedStates.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {selectedStates.length} states selected
                      </p>
                    )}
                  </div>

                  {/* Contract Value Range */}
                  <div className="space-y-2">
                    <Label>Preferred Contract Value Range</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      What size contracts are you targeting?
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor="minValue" className="text-xs">Minimum ($)</Label>
                        <Input
                          id="minValue"
                          type="number"
                          value={minValue}
                          onChange={(e) => setMinValue(e.target.value)}
                          placeholder="10000"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="maxValue" className="text-xs">Maximum ($)</Label>
                        <Input
                          id="maxValue"
                          type="number"
                          value={maxValue}
                          onChange={(e) => setMaxValue(e.target.value)}
                          placeholder="500000"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={savingProfile || !companyName}>
                {savingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {companyProfile ? "Update Profile" : "Save Profile"}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Subscription */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Subscription
            </CardTitle>
            <CardDescription>
              Manage your subscription and billing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingSubscription ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">
                        {subscription?.tier || "Free"} Plan
                      </h3>
                      <Badge variant={subscription?.isActive ? "default" : "secondary"}>
                        {subscription?.isActive ? "Active" : "Current"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {subscription?.tier === "FREE"
                        ? "Limited searches, no alerts"
                        : subscription?.tier === "BASIC"
                        ? "100 searches/day, alerts enabled"
                        : subscription?.tier === "PRO"
                        ? "Unlimited searches, API access"
                        : subscription?.tier === "ENTERPRISE"
                        ? "Full access, dedicated support"
                        : "Limited searches, no alerts"}
                    </p>
                    {subscription?.currentPeriodEnd && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Renews on{" "}
                        {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {subscription?.isActive && (
                      <Button
                        variant="outline"
                        onClick={handleOpenBillingPortal}
                        disabled={openingPortal}
                      >
                        {openingPortal ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <ExternalLink className="mr-2 h-4 w-4" />
                        )}
                        Manage
                      </Button>
                    )}
                    <Button asChild>
                      <Link href="/pricing">
                        {subscription?.tier === "FREE" ? "Upgrade" : "Change Plan"}
                      </Link>
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Plan Features</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>
                      •{" "}
                      {subscription?.features?.searchesPerDay === -1
                        ? "Unlimited"
                        : subscription?.features?.searchesPerDay || 10}{" "}
                      searches per day
                    </li>
                    <li>
                      •{" "}
                      {subscription?.features?.savedSearches === -1
                        ? "Unlimited"
                        : subscription?.features?.savedSearches || 3}{" "}
                      saved searches
                    </li>
                    <li>
                      • Alerts:{" "}
                      {subscription?.features?.alerts ? "Enabled" : "Disabled"}
                    </li>
                    <li>
                      • API Access:{" "}
                      {subscription?.features?.apiAccess ? "Enabled" : "Disabled"}
                    </li>
                  </ul>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Preferences
            </CardTitle>
            <CardDescription>
              Control how and when you receive notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Email Notifications</p>
                <p className="text-sm text-muted-foreground">
                  Receive contract alerts via email
                </p>
              </div>
              <Badge variant="outline">Enabled</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Weekly Digest</p>
                <p className="text-sm text-muted-foreground">
                  Summary of new contracts matching your criteria
                </p>
              </div>
              <Badge variant="outline">Enabled</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Product Updates</p>
                <p className="text-sm text-muted-foreground">
                  New features and improvements
                </p>
              </div>
              <Badge variant="secondary">Disabled</Badge>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline">Manage Notifications</Button>
          </CardFooter>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security
            </CardTitle>
            <CardDescription>
              Keep your account secure
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Password</p>
                <p className="text-sm text-muted-foreground">
                  Last changed: Never
                </p>
              </div>
              <Button variant="outline">Change Password</Button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Two-Factor Authentication</p>
                <p className="text-sm text-muted-foreground">
                  Add an extra layer of security
                </p>
              </div>
              <Button variant="outline">Enable 2FA</Button>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Irreversible actions for your account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Sign Out</p>
                <p className="text-sm text-muted-foreground">
                  Sign out of your account on this device
                </p>
              </div>
              <Button variant="outline" onClick={handleSignOut}>
                Sign Out
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Delete Account</p>
                <p className="text-sm text-muted-foreground">
                  Permanently delete your account and all data
                </p>
              </div>
              <Button variant="destructive">Delete Account</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
