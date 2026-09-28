"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlarmClock,
  Bell,
  BellOff,
  Droplets,
  Footprints,
  Minus,
  Moon,
  Plus,
  Target,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { EmptyState, PageLoader, Spinner } from "@/components/ui/feedback";
import { Progress } from "@/components/ui/progress";
import { Tabs } from "@/components/ui/tabs";
import { http } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Goal, Reminder } from "@/types";

const GOAL_ICONS: Record<string, typeof Target> = {
  water: Droplets,
  sleep: Moon,
  steps: Footprints,
  exercise: Target,
  weight: Target,
  custom: Target,
};

const DEFAULT_UNITS: Record<string, string> = {
  water: "glasses",
  sleep: "hours",
  steps: "steps",
  exercise: "minutes",
  weight: "kg",
  custom: "units",
};

export default function GoalsPage() {
  const [tab, setTab] = useState("goals");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [goalForm, setGoalForm] = useState({ type: "water", title: "", target: "8", unit: "glasses", frequency: "daily" });
  const [reminderForm, setReminderForm] = useState({ title: "", type: "water", time: "09:00", frequency: "daily" });

  const load = useCallback(async () => {
    try {
      const [goalsRes, remindersRes] = await Promise.all([
        http.get<Goal[]>("/api/goals"),
        http.get<Reminder[]>("/api/reminders"),
      ]);
      setGoals(goalsRes);
      setReminders(remindersRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your goals.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createGoal = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await http.post("/api/goals", {
        type: goalForm.type,
        title: goalForm.title || `Reach ${goalForm.target} ${goalForm.unit}`,
        target: Number(goalForm.target) || 1,
        unit: goalForm.unit,
        frequency: goalForm.frequency,
      });
      setGoalForm({ type: "water", title: "", target: "8", unit: "glasses", frequency: "daily" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create that goal.");
    } finally {
      setBusy(false);
    }
  };

  const updateProgress = async (goal: Goal, delta: number) => {
    const next = Math.max(0, Math.min(goal.target * 2, goal.progress + delta));
    setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, progress: next } : g)));
    try {
      const updated = await http.put<Goal>(`/api/goals/${goal.id}/progress`, { progress: next });
      setGoals((prev) => prev.map((g) => (g.id === goal.id ? updated : g)));
    } catch {
      await load();
    }
  };

  const removeGoal = async (id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    try {
      await http.del(`/api/goals/${id}`);
    } catch {
      await load();
    }
  };

  const createReminder = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await http.post("/api/reminders", {
        title: reminderForm.title || "Health reminder",
        type: reminderForm.type,
        time: reminderForm.time,
        frequency: reminderForm.frequency,
      });
      setReminderForm({ title: "", type: "water", time: "09:00", frequency: "daily" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create that reminder.");
    } finally {
      setBusy(false);
    }
  };

  const toggleReminder = async (reminder: Reminder) => {
    setReminders((prev) =>
      prev.map((r) => (r.id === reminder.id ? { ...r, isActive: !r.isActive } : r)),
    );
    try {
      await http.put(`/api/reminders/${reminder.id}`, { isActive: !reminder.isActive });
    } catch {
      await load();
    }
  };

  const removeReminder = async (id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
    try {
      await http.del(`/api/reminders/${id}`);
    } catch {
      await load();
    }
  };

  const completed = goals.filter((goal) => goal.progress >= goal.target).length;

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Goals & Reminders</h1>
            <p className="text-sm text-muted-foreground">
              Set simple daily targets and gentle nudges to stay on track.
            </p>
          </div>
          {goals.length > 0 && (
            <Badge variant="success">
              {completed}/{goals.length} goals met today
            </Badge>
          )}
        </div>

        <Tabs
          value={tab}
          onValueChange={setTab}
          tabs={[
            { value: "goals", label: "Goals", icon: <Target className="h-4 w-4" /> },
            { value: "reminders", label: "Reminders", icon: <AlarmClock className="h-4 w-4" /> },
          ]}
        />

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <PageLoader />
        ) : tab === "goals" ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <div className="space-y-3">
              {goals.length === 0 ? (
                <EmptyState
                  icon={<Target className="h-6 w-6" />}
                  title="No goals yet"
                  description="Create your first goal to start tracking progress."
                />
              ) : (
                goals.map((goal) => {
                  const Icon = GOAL_ICONS[goal.type] ?? Target;
                  const done = goal.progress >= goal.target;
                  return (
                    <Card key={goal.id} className={cn(done && "border-emerald-300 bg-emerald-50/40")}>
                      <CardContent className="p-5">
                        <div className="flex items-start gap-4">
                          <div
                            className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                              done ? "bg-emerald-100 text-emerald-700" : "bg-primary/10 text-primary",
                            )}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{goal.title}</p>
                              {goal.streak > 0 && <Badge variant="success">{goal.streak} day streak</Badge>}
                              {done && <Badge variant="success">Completed</Badge>}
                            </div>
                            <Progress value={goal.progress} max={goal.target} />
                            <p className="text-xs tabular-nums text-muted-foreground">
                              {goal.progress} of {goal.target} {goal.unit} · {goal.frequency}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-2">
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => void updateProgress(goal, -1)}
                                aria-label="Decrease progress"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => void updateProgress(goal, 1)}
                                aria-label="Increase progress"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <button
                              onClick={() => void removeGoal(goal.id)}
                              className="text-xs text-muted-foreground transition-colors hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>

            <Card className="h-fit">
              <CardHeader>
                <CardTitle>New goal</CardTitle>
                <CardDescription>Start small and stay consistent.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={createGoal} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="goalType">Type</Label>
                    <Select
                      id="goalType"
                      value={goalForm.type}
                      onChange={(e) =>
                        setGoalForm({
                          ...goalForm,
                          type: e.target.value,
                          unit: DEFAULT_UNITS[e.target.value] ?? "units",
                        })
                      }
                    >
                      {Object.keys(DEFAULT_UNITS).map((type) => (
                        <option key={type} value={type} className="capitalize">
                          {type}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="goalTitle">Title (optional)</Label>
                    <Input
                      id="goalTitle"
                      value={goalForm.title}
                      onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
                      placeholder="Drink more water"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="goalTarget">Target</Label>
                      <Input
                        id="goalTarget"
                        type="number"
                        min="1"
                        value={goalForm.target}
                        onChange={(e) => setGoalForm({ ...goalForm, target: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="goalUnit">Unit</Label>
                      <Input
                        id="goalUnit"
                        value={goalForm.unit}
                        onChange={(e) => setGoalForm({ ...goalForm, unit: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="goalFrequency">Frequency</Label>
                    <Select
                      id="goalFrequency"
                      value={goalForm.frequency}
                      onChange={(e) => setGoalForm({ ...goalForm, frequency: e.target.value })}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full gap-2" disabled={busy}>
                    {busy ? <Spinner /> : <Plus className="h-4 w-4" />}
                    Create goal
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <div className="space-y-3">
              {reminders.length === 0 ? (
                <EmptyState
                  icon={<AlarmClock className="h-6 w-6" />}
                  title="No reminders yet"
                  description="Add a reminder for water, medication or a walk."
                />
              ) : (
                reminders.map((reminder) => (
                  <Card key={reminder.id} className={cn(!reminder.isActive && "opacity-60")}>
                    <CardContent className="flex items-center gap-4 p-4">
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                          reminder.isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {reminder.isActive ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{reminder.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {reminder.time} · {reminder.frequency}
                          {reminder.days.length > 0 ? ` · ${reminder.days.join(", ")}` : ""}
                        </p>
                      </div>
                      <Button
                        variant={reminder.isActive ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => void toggleReminder(reminder)}
                      >
                        {reminder.isActive ? "Active" : "Paused"}
                      </Button>
                      <button
                        onClick={() => void removeReminder(reminder.id)}
                        className="text-muted-foreground transition-colors hover:text-destructive"
                        aria-label="Delete reminder"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            <Card className="h-fit">
              <CardHeader>
                <CardTitle>New reminder</CardTitle>
                <CardDescription>A gentle nudge at a set time.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={createReminder} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reminderTitle">Title</Label>
                    <Input
                      id="reminderTitle"
                      value={reminderForm.title}
                      onChange={(e) => setReminderForm({ ...reminderForm, title: e.target.value })}
                      placeholder="Drink water"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reminderType">Type</Label>
                    <Select
                      id="reminderType"
                      value={reminderForm.type}
                      onChange={(e) => setReminderForm({ ...reminderForm, type: e.target.value })}
                    >
                      {["water", "medicine", "activity", "sleep", "meal", "custom"].map((type) => (
                        <option key={type} value={type} className="capitalize">
                          {type}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="reminderTime">Time</Label>
                      <Input
                        id="reminderTime"
                        type="time"
                        value={reminderForm.time}
                        onChange={(e) => setReminderForm({ ...reminderForm, time: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reminderFrequency">Repeat</Label>
                      <Select
                        id="reminderFrequency"
                        value={reminderForm.frequency}
                        onChange={(e) => setReminderForm({ ...reminderForm, frequency: e.target.value })}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                      </Select>
                    </div>
                  </div>
                  <Button type="submit" className="w-full gap-2" disabled={busy}>
                    {busy ? <Spinner /> : <Plus className="h-4 w-4" />}
                    Add reminder
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
