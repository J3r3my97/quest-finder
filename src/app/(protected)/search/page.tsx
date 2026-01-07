"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  SlidersHorizontal,
  Calendar,
  DollarSign,
  Building2,
  Bookmark,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { ContractLead } from "@/types";

interface ApiResponse {
  data: ContractLead[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const agencies = [
  "All Agencies",
  "Department of Defense",
  "Department of Homeland Security",
  "General Services Administration",
  "Department of Veterans Affairs",
  "Department of Commerce",
  "Department of Health and Human Services",
  "Department of the Treasury",
  "Department of Justice",
  "Department of Education",
];

const setAsideTypes = [
  { value: "all", label: "All Types" },
  { value: "SBA", label: "Small Business (SBA)" },
  { value: "8A", label: "8(a)" },
  { value: "WOSB", label: "Women-Owned (WOSB)" },
  { value: "SDVOSBC", label: "SDVOSB" },
  { value: "HZC", label: "HUBZone" },
];

const sortOptions = [
  { value: "postedDate_desc", label: "Newest First" },
  { value: "postedDate_asc", label: "Oldest First" },
  { value: "estimatedValue_desc", label: "Highest Value" },
  { value: "estimatedValue_asc", label: "Lowest Value" },
  { value: "responseDeadline_asc", label: "Deadline (Soonest)" },
];

function formatCurrency(value: number | string | null): string {
  if (!value) return "TBD";
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(numValue);
}

function formatDate(date: Date | string | null): string {
  if (!date) return "TBD";
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(dateObj);
}

function getSetAsideLabel(type: string | null | undefined): string {
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

function ContractCard({ contract }: { contract: ContractLead }) {
  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Link
              href={`/contracts/${contract.id}`}
              className="font-semibold hover:underline text-lg"
            >
              {contract.title}
            </Link>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" />
              {contract.agency}
            </div>
          </div>
          <Badge variant="secondary" className="shrink-0">
            {getSetAsideLabel(contract.setAsideType)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <CardDescription className="line-clamp-2">
          {contract.description}
        </CardDescription>
        <div className="flex flex-wrap gap-2">
          {contract.naicsCodes.map((code) => (
            <Badge key={code} variant="outline">
              NAICS: {code}
            </Badge>
          ))}
        </div>
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{formatCurrency(contract.estimatedValue ?? null)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Due: {formatDate(contract.responseDeadline ?? null)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">
              <Bookmark className="h-4 w-4" />
            </Button>
            {contract.sourceUrl && (
              <Button variant="ghost" size="sm" asChild>
                <a href={contract.sourceUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-6 w-[300px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
          <Skeleton className="h-6 w-[80px]" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-[100px]" />
          <Skeleton className="h-6 w-[100px]" />
        </div>
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex gap-4">
            <Skeleton className="h-5 w-[80px]" />
            <Skeleton className="h-5 w-[120px]" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SearchPage() {
  const [keyword, setKeyword] = useState("");
  const [agency, setAgency] = useState("All Agencies");
  const [setAsideType, setSetAsideType] = useState("all");
  const [naicsCodes, setNaicsCodes] = useState("");
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const [sortBy, setSortBy] = useState("postedDate_desc");
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(true);
  const [contracts, setContracts] = useState<ContractLead[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchContracts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "10");

      if (keyword) params.set("keyword", keyword);
      if (agency !== "All Agencies") params.set("agency", agency);
      if (setAsideType !== "all") params.set("setAsideType", setAsideType);
      if (naicsCodes) params.set("naicsCodes", naicsCodes);
      if (minValue) params.set("estimatedValueMin", minValue);
      if (maxValue) params.set("estimatedValueMax", maxValue);

      const [sortField, sortOrder] = sortBy.split("_");
      params.set("sortBy", sortField);
      params.set("sortOrder", sortOrder);

      const response = await fetch(`/api/contracts?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch contracts");

      const data: ApiResponse = await response.json();
      setContracts(data.data);
      setTotalPages(data.pagination.totalPages);
      setTotalCount(data.pagination.total);
    } catch (error) {
      console.error("Error fetching contracts:", error);
      setContracts([]);
    } finally {
      setIsLoading(false);
    }
  }, [page, keyword, agency, setAsideType, naicsCodes, minValue, maxValue, sortBy]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchContracts();
  };

  const clearFilters = () => {
    setKeyword("");
    setAgency("All Agencies");
    setSetAsideType("all");
    setNaicsCodes("");
    setMinValue("");
    setMaxValue("");
    setPage(1);
  };

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Search Contracts</h1>
        <p className="text-muted-foreground mt-1">
          Find government contract opportunities that match your capabilities
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-4">
        {/* Filters Sidebar */}
        <aside className={`lg:col-span-1 ${showFilters ? "" : "hidden lg:block"}`}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Filters</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden"
                  onClick={() => setShowFilters(false)}
                >
                  Hide
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="agency">Agency</Label>
                <Select value={agency} onValueChange={setAgency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {agencies.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="setAside">Set-Aside Type</Label>
                <Select value={setAsideType} onValueChange={setSetAsideType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {setAsideTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="naics">NAICS Codes</Label>
                <Input
                  id="naics"
                  placeholder="e.g., 541512, 518210"
                  value={naicsCodes}
                  onChange={(e) => setNaicsCodes(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Contract Value Range</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Min ($)"
                    type="number"
                    value={minValue}
                    onChange={(e) => setMinValue(e.target.value)}
                  />
                  <Input
                    placeholder="Max ($)"
                    type="number"
                    value={maxValue}
                    onChange={(e) => setMaxValue(e.target.value)}
                  />
                </div>
              </div>

              <Button variant="outline" className="w-full" onClick={clearFilters}>
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        </aside>

        {/* Results */}
        <div className="lg:col-span-3 space-y-6">
          {/* Search Bar */}
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by keyword, title, or description..."
                className="pl-10"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="lg:hidden"
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Searching..." : "Search"}
            </Button>
          </form>

          {/* Results Header */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {totalCount} contracts found
            </p>
            <div className="flex items-center gap-2">
              <Label htmlFor="sort" className="text-sm">
                Sort by:
              </Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Contract List */}
          <div className="space-y-4">
            {isLoading ? (
              <>
                <LoadingSkeleton />
                <LoadingSkeleton />
                <LoadingSkeleton />
              </>
            ) : contracts.length > 0 ? (
              contracts.map((contract) => (
                <ContractCard key={contract.id} contract={contract} />
              ))
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">No contracts found</p>
                  <p className="text-muted-foreground mt-1">
                    Try adjusting your filters or search terms
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Pagination */}
          {contracts.length > 0 && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={pageNum === page ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
