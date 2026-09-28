"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, Droplets, Footprints, Moon, Save, Smile } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/health/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { PageLoader, Spinner } from "@/components/ui/feedback";
import { http } from "@/lib/api";
import { todayISO } from "@/lib/utils";
import type { WellnessLog, WellnessSummary } from "@/types";

const MOODS = ["great", "good", "okay", "low", "bad"];

export default function WellnessPage() {
  const [form, setForm] = useState({
    logDate: todayISO(),
    waterGlasses: "8",
    sleepHours: "7",
    steps: "8000",
    exerciseMinutes: "30",
    mood: "good",
    weightKg: "",
    note: "",
  });
  const [summary, setSummary] = useState<WellnessSummary | null>(null);
  const [logs, setLogs] = useState<WellnessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const [summaryRes, logsRes] = await Promise.all([
        http.get<WellnessSummary>("/api/wellness/summary?days=14"),
        http.get<WellnessLog[]>("/api/wellness/logs?days=14"),
      ]);
      setSummary(summaryRes);
      setLogs(logsRes);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await http.post("/api/wellness/logs", {
        logDate: form.logDate,
        waterGlasses: Number(form.waterGlasses) || 0,
        sleepHours: Number(form.sleepHours) || 0,
        steps: Number(form.steps) || 0,
        exerciseMinutes: Number(form.exerciseMinutes) || 0,
        mood: form.mood,
        weightKg: form.weightKg ? Number(form.weightKg) : undefined,
        note: form.note || undefined,
      });
      setMessage("Today's log saved.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save your log.");
    } finally {
      setSaving(false);
    }
  };

  const averages = summary?.averages ?? {};
  const series = (summary?.series ?? []).map((point) => ({
    ...point,
    label: typeof point.date === "string" ? point.date.slice(5) : "",
  }));

  const moodCounts = logs.reduce<Record<string, number>>((acc, log) => {
    if (log.mood) acc[log.mood] = (acc[log.mood] ?? 0) + 1;
    return acc;
  }, {});
  const moodData = MOODS.map((mood) => ({ mood, days: moodCounts[mood] ?? 0 }));

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Wellness Tracker</h1>
          <p className="text-sm text-muted-foreground">
            Log water, sleep, movement and mood each day. Small, consistent habits add up.
          </p>
        </div>

        {loading ? (
          <PageLoader label="Loading your wellness data..." />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Water / day" value={(averages.waterGlasses ?? 0).toFixed(1)} hint="glasses average" icon={<Droplets className="h-5 w-5" />} accent="sky" />
              <StatCard label="Sleep / night" value={`${(averages.sleepHours ?? 0).toFixed(1)}h`} hint="average" icon={<Moon className="h-5 w-5" />} accent="primary" />
              <StatCard label="Steps / day" value={Math.round(averages.steps ?? 0).toLocaleString()} hint="average" icon={<Footprints className="h-5 w-5" />} accent="emerald" />
              <StatCard label="Exercise / day" value={`${Math.round(averages.exerciseMinutes ?? 0)}m`} hint="average" icon={<Activity className="h-5 w-5" />} accent="amber" />
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Log your day</CardTitle>
                  <CardDescription>Saving the same date again updates that day.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={save} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="logDate">Date</Label>
                      <Input
                        id="logDate"
                        type="date"
                        value={form.logDate}
                        max={todayISO()}
                        onChange={(e) => setForm({ ...form, logDate: e.target.value })}
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="water">Water (glasses)</Label>
                        <Input id="water" type="number" min="0" max="30" value={form.waterGlasses} onChange={(e) => setForm({ ...form, waterGlasses: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sleep">Sleep (hours)</Label>
                        <Input id="sleep" type="number" step="0.5" min="0" max="24" value={form.sleepHours} onChange={(e) => setForm({ ...form, sleepHours: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="steps">Steps</Label>
                        <Input id="steps" type="number" min="0" value={form.steps} onChange={(e) => setForm({ ...form, steps: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="exercise">Exercise (min)</Label>
                        <Input id="exercise" type="number" min="0" value={form.exerciseMinutes} onChange={(e) => setForm({ ...form, exerciseMinutes: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="mood">Mood</Label>
                        <Select id="mood" value={form.mood} onChange={(e) => setForm({ ...form, mood: e.target.value })}>
                          {MOODS.map((mood) => (
                            <option key={mood} value={mood} className="capitalize">
                              {mood}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="weight">Weight (kg, optional)</Label>
                        <Input id="weight" type="number" step="0.1" value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value })} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="note">Note (optional)</Label>
                      <Textarea id="note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="How did today feel?" className="min-h-[70px]" />
                    </div>

                    {message && (
                      <p className="rounded-md bg-muted/60 px-3 py-2 text-sm text-muted-foreground">{message}</p>
                    )}

                    <Button type="submit" disabled={saving} className="w-full gap-2">
                      {saving ? <Spinner /> : <Save className="h-4 w-4" />}
                      Save log
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Water & sleep trend</CardTitle>
                    <CardDescription>Last 14 days</CardDescription>
                  </CardHeader>
                  <CardContent className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={series} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="waterFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="sleepFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0f766e" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: 8,
                            border: "1px solid hsl(var(--border))",
                            fontSize: 12,
                          }}
                        />
                        <Area type="monotone" dataKey="waterGlasses" name="Water" stroke="#0ea5e9" fill="url(#waterFill)" strokeWidth={2} />
                        <Area type="monotone" dataKey="sleepHours" name="Sleep (h)" stroke="#0f766e" fill="url(#sleepFill)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Steps & mood</CardTitle>
                    <CardDescription>Movement across the last 14 days</CardDescription>
                  </CardHeader>
                  <CardContent className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={series} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: 8,
                            border: "1px solid hsl(var(--border))",
                            fontSize: 12,
                          }}
                        />
                        <Bar dataKey="steps" name="Steps" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Smile className="h-4 w-4 text-primary" />
                      Mood balance
                    </CardTitle>
                    <CardDescription>How your days have felt</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {moodData.map(({ mood, days }) => {
                        const max = Math.max(...moodData.map((m) => m.days), 1);
                        return (
                          <div key={mood} className="flex items-center gap-3 text-sm">
                            <span className="w-14 capitalize text-muted-foreground">{mood}</span>
                            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary/70 transition-all"
                                style={{ width: `${(days / max) * 100}%` }}
                              />
                            </div>
                            <span className="w-6 text-right tabular-nums text-muted-foreground">{days}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
