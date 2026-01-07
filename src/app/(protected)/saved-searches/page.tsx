"use client";

import { useState } from "react";
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
  DialogTrigger,
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
import type { SavedSearch, Alert, AlertFrequency } from "@/types";

// Extended type for display purposes
interface SavedSearchWithAlert extends SavedSearch {
  alert?: Alert;
  matchCount: number;
}

// Mock data for saved searches
const mockSavedSearches: SavedSearchWithAlert[] = [
  {
    id: "1",
    userId: "user1",
    name: "IT Services - DOD",
    filters: {
      keyword: "IT support services",
      agency: "Department of Defense",
      naicsCodes: ["541512"],
      setAsideType: "SBA",
    },
    createdAt: new Date("2024-01-05"),
    updatedAt: new Date("2024-01-05"),
    alert: {
      id: "a1",
      userId: "user1",
      savedSearchId: "1",
      frequency: "DAILY",
      lastSentAt: new Date("2024-01-15"),
      lastMatchCount: 5,
      isActive: true,
      createdAt: new Date("2024-01-05"),
      updatedAt: new Date("2024-01-15"),
    },
    matchCount: 42,
  },
  {
    id: "2",
    userId: "user1",
    name: "Cybersecurity Contracts",
    filters: {
      keyword: "cybersecurity",
      naicsCodes: ["541519"],
      setAsideType: "8A",
    },
    createdAt: new Date("2024-01-08"),
    updatedAt: new Date("2024-01-08"),
    alert: {
      id: "a2",
      userId: "user1",
      savedSearchId: "2",
      frequency: "WEEKLY",
      lastSentAt: new Date("2024-01-10"),
      lastMatchCount: 3,
      isActive: true,
      createdAt: new Date("2024-01-08"),
      updatedAt: new Date("2024-01-10"),
    },
    matchCount: 28,
  },
  {
    id: "3",
    userId: "user1",
    name: "Cloud Services",
    filters: {
      keyword: "cloud migration AWS",
      naicsCodes: ["541512", "518210"],
      estimatedValueMin: 1000000,
      estimatedValueMax: 5000000,
    },
    createdAt: new Date("2024-01-10"),
    updatedAt: new Date("2024-01-10"),
    matchCount: 15,
  },
  {
    id: "4",
    userId: "user1",
    name: "VA Healthcare IT",
    filters: {
      keyword: "healthcare software",
      agency: "Department of Veterans Affairs",
      setAsideType: "SDVOSBC",
    },
    createdAt: new Date("2024-01-12"),
    updatedAt: new Date("2024-01-12"),
    alert: {
      id: "a4",
      userId: "user1",
      savedSearchId: "4",
      frequency: "REALTIME",
      lastSentAt: null,
      lastMatchCount: 0,
      isActive: false,
      createdAt: new Date("2024-01-12"),
      updatedAt: new Date("2024-01-12"),
    },
    matchCount: 8,
  },
];

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getFrequencyLabel(frequency: AlertFrequency): string {
  const labels: Record<AlertFrequency, string> = {
    DAILY: "Daily",
    WEEKLY: "Weekly",
    REALTIME: "Instant",
  };
  return labels[frequency];
}

function formatFilters(filters: SavedSearch["filters"]): string {
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
  return parts.join(" • ");
}

export default function SavedSearchesPage() {
  const [searches, setSearches] = useState(mockSavedSearches);
  const [editingSearch, setEditingSearch] = useState<typeof mockSavedSearches[0] | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const toggleAlert = (searchId: string) => {
    setSearches((prev) =>
      prev.map((search) => {
        if (search.id === searchId && search.alert) {
          return {
            ...search,
            alert: { ...search.alert, isActive: !search.alert.isActive },
          };
        }
        return search;
      })
    );
    toast.success("Alert settings updated");
  };

  const deleteSearch = (searchId: string) => {
    setSearches((prev) => prev.filter((s) => s.id !== searchId));
    toast.success("Search deleted");
  };

  const updateSearchName = (searchId: string, newName: string) => {
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
                    <CardDescription>{formatFilters(search.filters)}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{search.matchCount} matches</Badge>
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
                        <SelectItem value="instant">Instant</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
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
