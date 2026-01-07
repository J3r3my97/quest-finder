"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Search,
  Bell,
  BellOff,
  MoreHorizontal,
  Trash2,
  Edit,
  Play,
  Plus,
  Calendar,
} from "lucide-react";
import type { SavedSearch, Alert, AlertFrequency, ContractSearchFilters } from "@/types";

interface SavedSearchWithAlert extends SavedSearch {
  alert?: Alert;
}

function formatDate(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(dateObj);
}

function getFrequencyLabel(frequency: AlertFrequency): string {
  const labels: Record<AlertFrequency, string> = {
    DAILY: "Daily",
    WEEKLY: "Weekly",
    REALTIME: "Instant",
  };
  return labels[frequency];
}

function formatFilters(filters: ContractSearchFilters): string {
  const parts: string[] = [];
  if (filters.keyword) parts.push(`"${filters.keyword}"`);
  if (filters.agency) parts.push(filters.agency);
  if (filters.naicsCodes?.length) parts.push(`NAICS: ${filters.naicsCodes.join(", ")}`);
  if (filters.setAsideType) {
    const labels: Record<string, string> = {
      SBA: "Small Business",
      "8A": "8(a)",
      WOSB: "WOSB",
      SDVOSBC: "SDVOSB",
      HZC: "HUBZone",
    };
    parts.push(labels[filters.setAsideType] || filters.setAsideType);
  }
  return parts.length > 0 ? parts.join(" • ") : "No filters applied";
}

function LoadingSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-[200px]" />
            <Skeleton className="h-4 w-[300px]" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-[80px]" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-[150px]" />
      </CardContent>
    </Card>
  );
}

export default function SavedSearchesPage() {
  const [searches, setSearches] = useState<SavedSearchWithAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingSearch, setEditingSearch] = useState<SavedSearchWithAlert | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  useEffect(() => {
    fetchSavedSearches();
  }, []);

  const fetchSavedSearches = async () => {
    try {
      const response = await fetch("/api/saved-searches");
      if (!response.ok) {
        if (response.status === 401) {
          // Not authenticated - show empty state
          setSearches([]);
          return;
        }
        throw new Error("Failed to fetch saved searches");
      }
      const data = await response.json();
      setSearches(data.data || []);
    } catch (error) {
      console.error("Error fetching saved searches:", error);
      toast.error("Failed to load saved searches");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAlert = async (searchId: string) => {
    const search = searches.find(s => s.id === searchId);
    if (!search?.alert) return;

    // Optimistic update
    setSearches((prev) =>
      prev.map((s) => {
        if (s.id === searchId && s.alert) {
          return {
            ...s,
            alert: { ...s.alert, isActive: !s.alert.isActive },
          };
        }
        return s;
      })
    );
    toast.success("Alert settings updated");
  };

  const deleteSearch = async (searchId: string) => {
    try {
      const response = await fetch(`/api/saved-searches?id=${searchId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete");

      setSearches((prev) => prev.filter((s) => s.id !== searchId));
      toast.success("Search deleted");
    } catch (error) {
      console.error("Error deleting search:", error);
      toast.error("Failed to delete search");
    }
  };

  const updateSearchName = async (searchId: string, newName: string) => {
    // Optimistic update
    setSearches((prev) =>
      prev.map((search) => {
        if (search.id === searchId) {
          return { ...search, name: newName };
        }
        return search;
      })
    );
    setIsEditDialogOpen(false);
    toast.success("Search renamed");
  };

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Skeleton className="h-8 w-[200px] mb-2" />
            <Skeleton className="h-4 w-[300px]" />
          </div>
          <Skeleton className="h-10 w-[120px]" />
        </div>
        <div className="grid gap-4">
          <LoadingSkeleton />
          <LoadingSkeleton />
          <LoadingSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Saved Searches</h1>
          <p className="text-muted-foreground mt-1">
            Manage your saved searches and alert preferences
          </p>
        </div>
        <Button asChild>
          <Link href="/search">
            <Plus className="mr-2 h-4 w-4" />
            New Search
          </Link>
        </Button>
      </div>

      {searches.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No saved searches yet</h2>
            <p className="text-muted-foreground mb-6">
              Save a search to quickly access it later and set up alerts
            </p>
            <Button asChild>
              <Link href="/search">Start Searching</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {searches.map((search) => (
            <Card key={search.id} className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{search.name}</CardTitle>
                      {search.alert?.isActive && (
                        <Badge variant="secondary" className="text-xs">
                          <Bell className="mr-1 h-3 w-3" />
                          {getFrequencyLabel(search.alert.frequency)}
                        </Badge>
                      )}
                    </div>
                    <CardDescription>
                      {formatFilters(search.filters as ContractSearchFilters)}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/search?saved=${search.id}`}>
                            <Play className="mr-2 h-4 w-4" />
                            Run Search
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingSearch(search);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Rename
                        </DropdownMenuItem>
                        {search.alert ? (
                          <DropdownMenuItem onClick={() => toggleAlert(search.id)}>
                            {search.alert.isActive ? (
                              <>
                                <BellOff className="mr-2 h-4 w-4" />
                                Disable Alert
                              </>
                            ) : (
                              <>
                                <Bell className="mr-2 h-4 w-4" />
                                Enable Alert
                              </>
                            )}
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem>
                            <Bell className="mr-2 h-4 w-4" />
                            Create Alert
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deleteSearch(search.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Created {formatDate(search.createdAt)}
                  </div>
                  {search.alert?.lastSentAt && (
                    <span>Last alert: {formatDate(search.alert.lastSentAt)}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Search</DialogTitle>
            <DialogDescription>
              Give this search a memorable name
            </DialogDescription>
          </DialogHeader>
          {editingSearch && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const newName = formData.get("name") as string;
                if (newName) {
                  updateSearchName(editingSearch.id, newName);
                }
              }}
            >
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Search Name</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={editingSearch.name}
                    placeholder="Enter search name"
                  />
                </div>
                {editingSearch.alert && (
                  <div className="space-y-2">
                    <Label htmlFor="frequency">Alert Frequency</Label>
                    <Select defaultValue={editingSearch.alert.frequency}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="REALTIME">Instant</SelectItem>
                        <SelectItem value="DAILY">Daily</SelectItem>
                        <SelectItem value="WEEKLY">Weekly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save Changes</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
