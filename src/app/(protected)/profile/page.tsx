"use client";

import { useState } from "react";
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
import { toast } from "sonner";
import { Loader2, User, Mail, Shield, CreditCard, Bell } from "lucide-react";
import Link from "next/link";

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const [isUpdating, setIsUpdating] = useState(false);
  const [name, setName] = useState(session?.user?.name || "");
  const [email, setEmail] = useState(session?.user?.email || "");

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
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">Free Plan</h3>
                  <Badge variant="secondary">Current</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Limited searches, no alerts
                </p>
              </div>
              <Button asChild>
                <Link href="/pricing">Upgrade</Link>
              </Button>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Plan Features</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• 10 searches per day</li>
                <li>• 3 saved searches</li>
                <li>• Basic filters</li>
              </ul>
            </div>
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
