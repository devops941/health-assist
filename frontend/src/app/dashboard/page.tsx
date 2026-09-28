"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  Bot,
  Droplets,
  Footprints,
  Moon,
  Sparkles,
  Stethoscope,
  Target,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/health/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EmptyState, PageLoader } from "@/components/ui/feedback";
import { http } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import type { Goal, SymptomCheck, WellnessSummary } from "@/types";

export default function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<WellnessSummary | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [checks, setChecks] = useState<SymptomCheck[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [summaryRes, goalsRes, checksRes] = await Promise.allSettled([
        http.get<WellnessSummary>("/api/wellness/summary?days=7"),
        http.get<Goal[]>("/api/goals"),
        http.get<SymptomCheck[]>("/api/symptoms/history"),
      ]);
      if (summaryRes.status === "fulfilled") setSummary(summaryRes.value);
      if (goalsRes.status === "fulfilled") setGoals(goalsRes.value);
      if (checksRes.status === "fulfilled") setChecks(checksRes.value.slice(0, 3));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const averages = summary?.averages ?? {};
  const logCount = summary?.logCount ?? 0;
  const activeGoals = goals.filter((goal) => goal.isActive);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">
              {user?.fullName ? `Hello, ${user.fullName.split(" ")[0]}` : "Dashboard"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Here is how your last 7 days look, plus a few things you can act on.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/chat">
              <Button className="gap-2">
                <Bot className="h-4 w-4" />
                Ask the assistant
              </Button>
            </Link>
            <Link href="/symptoms">
              <Button variant="outline" className="gap-2">
                <Stethoscope className="h-4 w-4" />
                Symptom check
              </Button>
            </Link>
          </div>
        </div>

        {loading ? (
          <PageLoader label="Loading your dashboard..." />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Water / day"
                value={`${(averages.waterGlasses ?? 0).toFixed(1)}`}
                hint="glasses, 7-day average"
                icon={<Droplets className="h-5 w-5" />}
                accent="sky"
              />
              <StatCard
                label="Sleep / night"
                value={`${(averages.sleepHours ?? 0).toFixed(1)}h`}
                hint="7-day average"
                icon={<Moon className="h-5 w-5" />}
                accent="primary"
              />
              <StatCard
                label="Steps / day"
                value={Math.round(averages.steps ?? 0).toLocaleString()}
                hint="7-day average"
                icon={<Footprints className="h-5 w-5" />}
                accent="emerald"
              />
              <StatCard
                label="Days logged"
                value={`${logCount}/7`}
                hint={logCount >= 5 ? "Great consistency" : "Keep logging daily"}
                icon={<Activity className="h-5 w-5" />}
                accent="amber"
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle>Active goals</CardTitle>
                    <CardDescription>Your daily habits and streaks</CardDescription>
                  </div>
                  <Link href="/goals" className="text-sm font-medium text-primary hover:underline">
                    Manage
                  </Link>
                </CardHeader>
                <CardContent className="space-y-4">
                  {activeGoals.length === 0 ? (
                    <EmptyState
                      icon={<Target className="h-6 w-6" />}
                      title="No goals yet"
                      description="Set a small daily goal to start building momentum."
                      action={
                        <Link href="/goals">
                          <Button size="sm">Create a goal</Button>
                        </Link>
                      }
                    />
                  ) : (
                    activeGoals.slice(0, 4).map((goal) => (
                      <div key={goal.id} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-medium">{goal.title}</span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {goal.progress}/{goal.target} {goal.unit}
                          </span>
                        </div>
                        <Progress value={goal.progress} max={goal.target} />
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {goal.streak > 0 && <Badge variant="success">{goal.streak} day streak</Badge>}
                          <span className="capitalize">{goal.frequency}</span>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quick actions</CardTitle>
                  <CardDescription>Jump straight to what you need</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { href: "/chat", label: "Ask a health question", icon: Bot },
                    { href: "/symptoms", label: "Run a symptom check", icon: Stethoscope },
                    { href: "/wellness", label: "Log today's wellness", icon: Activity },
                    { href: "/tips", label: "Get AI wellness tips", icon: Sparkles },
                    { href: "/history", label: "Review past activity", icon: Target },
                  ].map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
                    >
                      <Icon className="h-4 w-4 text-primary" />
                      <span className="flex-1">{label}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Recent symptom checks</CardTitle>
                  <CardDescription>Your last few assessments</CardDescription>
                </div>
                <Link href="/history" className="text-sm font-medium text-primary hover:underline">
                  View all
                </Link>
              </CardHeader>
              <CardContent>
                {checks.length === 0 ? (
                  <EmptyState
                    icon={<Stethoscope className="h-6 w-6" />}
                    title="No symptom checks yet"
                    description="Describe what you are feeling and get structured guidance."
                    action={
                      <Link href="/symptoms">
                        <Button size="sm">Start a check</Button>
                      </Link>
                    }
                  />
                ) : (
                  <ul className="divide-y">
                    {checks.map((check) => (
                      <li key={check.id} className="flex flex-wrap items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {check.symptoms.join(", ") || "Symptom check"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(check.createdAt)}
                            {check.duration ? ` · ${check.duration}` : ""}
                          </p>
                        </div>
                        <Badge
                          variant={
                            check.urgency === "emergency" || check.urgency === "urgent"
                              ? "destructive"
                              : check.urgency === "soon"
                                ? "warning"
                                : "secondary"
                          }
                        >
                          {check.urgency}
                        </Badge>
                        {check.redFlag && <Badge variant="destructive">red flag</Badge>}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
