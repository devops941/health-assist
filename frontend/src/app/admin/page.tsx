"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  Download,
  Flag,
  MessageSquare,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { StatCard } from "@/components/health/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { EmptyState, PageLoader, Spinner } from "@/components/ui/feedback";
import { Tabs } from "@/components/ui/tabs";
import { getToken, http } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/utils";
import type { AdminSetting, AdminStats, FlaggedChat, User } from "@/types";

export default function AdminPage() {
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [flagged, setFlagged] = useState<FlaggedChat[]>([]);
  const [settings, setSettings] = useState<AdminSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [settingDrafts, setSettingDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setError("");
    try {
      const [statsRes, usersRes, flaggedRes, settingsRes] = await Promise.all([
        http.get<AdminStats>("/api/admin/stats"),
        http.get<User[]>("/api/admin/users"),
        http.get<FlaggedChat[]>("/api/admin/flagged"),
        http.get<AdminSetting[]>("/api/admin/settings"),
      ]);
      setStats(statsRes);
      setUsers(usersRes);
      setFlagged(flaggedRes);
      setSettings(settingsRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load admin data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleUser = async (user: User) => {
    setBusy(true);
    try {
      await http.patch(`/api/admin/users/${user.id}/status?isActive=${!user.isActive}`);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isActive: !u.isActive } : u)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update that user.");
    } finally {
      setBusy(false);
    }
  };

  const markReviewed = async (chat: FlaggedChat) => {
    try {
      await http.patch(`/api/admin/flagged/${chat.id}/review`);
      setFlagged((prev) => prev.map((c) => (c.id === chat.id ? { ...c, reviewed: true } : c)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update that record.");
    }
  };

  const saveSetting = async (key: string, raw: string) => {
    setBusy(true);
    setError("");
    let value: unknown = raw;
    try {
      value = JSON.parse(raw);
    } catch {
      value = raw;
    }
    try {
      const updated = await http.put<AdminSetting>(`/api/admin/settings/${key}`, { value });
      setSettings((prev) => prev.map((s) => (s.key === key ? updated : s)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that setting.");
    } finally {
      setBusy(false);
    }
  };

  const downloadReport = async (path: string, filename: string) => {
    try {
      const token = getToken();
      const response = await fetch(path, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error("Report unavailable");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download the report.");
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              <ShieldCheck className="h-6 w-6 text-primary" />
              Admin Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              Usage, safety flags and platform settings.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => void downloadReport("/api/admin/reports/summary.csv", "summary.csv")}
            >
              <Download className="h-4 w-4" />
              Summary CSV
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => void downloadReport("/api/admin/reports/flagged.csv", "flagged.csv")}
            >
              <Download className="h-4 w-4" />
              Flagged CSV
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <Tabs
          value={tab}
          onValueChange={setTab}
          tabs={[
            { value: "overview", label: "Overview", icon: <Activity className="h-4 w-4" /> },
            { value: "flagged", label: `Flagged (${flagged.length})`, icon: <Flag className="h-4 w-4" /> },
            { value: "users", label: `Users (${users.length})`, icon: <Users className="h-4 w-4" /> },
            { value: "settings", label: "Settings", icon: <Settings2 className="h-4 w-4" /> },
          ]}
        />

        {loading ? (
          <PageLoader label="Loading admin data..." />
        ) : tab === "overview" ? (
          stats && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard label="Total users" value={stats.totalUsers} hint={`${stats.activeUsers} active`} icon={<Users className="h-5 w-5" />} accent="primary" />
                <StatCard label="Conversations" value={stats.totalConversations} hint={`${stats.totalMessages} messages`} icon={<MessageSquare className="h-5 w-5" />} accent="sky" />
                <StatCard label="Symptom checks" value={stats.totalSymptomChecks} hint="all time" icon={<Activity className="h-5 w-5" />} accent="emerald" />
                <StatCard label="Flagged chats" value={stats.flaggedChats} hint="safety escalations" icon={<AlertTriangle className="h-5 w-5" />} accent="rose" />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Chats per day</CardTitle>
                    <CardDescription>Last 14 days</CardDescription>
                  </CardHeader>
                  <CardContent className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={stats.dailyChats.map((d) => ({ ...d, label: d.date.slice(5) }))}
                        margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                        <Bar dataKey="count" name="Chats" fill="#0f766e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>User growth</CardTitle>
                    <CardDescription>New signups, last 14 days</CardDescription>
                  </CardHeader>
                  <CardContent className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={stats.userGrowth.map((d) => ({ ...d, label: d.date.slice(5) }))}
                        margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                        <Line type="monotone" dataKey="count" name="Signups" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Top topics</CardTitle>
                  <CardDescription>What users ask about most</CardDescription>
                </CardHeader>
                <CardContent>
                  {stats.topTopics.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No topic data yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {stats.topTopics.map((topic) => {
                        const max = Math.max(...stats.topTopics.map((t) => t.count), 1);
                        return (
                          <div key={topic.topic} className="flex items-center gap-3 text-sm">
                            <span className="w-28 shrink-0 truncate capitalize text-muted-foreground">{topic.topic}</span>
                            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-primary/70" style={{ width: `${(topic.count / max) * 100}%` }} />
                            </div>
                            <span className="w-8 text-right tabular-nums text-muted-foreground">{topic.count}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )
        ) : tab === "flagged" ? (
          flagged.length === 0 ? (
            <EmptyState
              icon={<Flag className="h-6 w-6" />}
              title="No flagged conversations"
              description="Safety escalations from chat and symptom checks will appear here."
            />
          ) : (
            <div className="space-y-3">
              {flagged.map((chat) => (
                <Card key={chat.id} className={chat.reviewed ? "opacity-70" : undefined}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={chat.severity === "critical" || chat.severity === "high" ? "destructive" : "warning"}>
                            {chat.severity}
                          </Badge>
                          <Badge variant="outline">{chat.source.replace("_", " ")}</Badge>
                          {chat.reviewed && <Badge variant="secondary">reviewed</Badge>}
                        </div>
                        <p className="mt-2 text-sm">{chat.content}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDate(chat.createdAt)} {formatTime(chat.createdAt)}
                          {chat.matchedRules.length > 0 ? ` · rules: ${chat.matchedRules.join(", ")}` : ""}
                        </p>
                      </div>
                      {!chat.reviewed && (
                        <Button variant="outline" size="sm" onClick={() => void markReviewed(chat)}>
                          Mark reviewed
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        ) : tab === "users" ? (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Name</th>
                      <th className="px-4 py-3 text-left font-medium">Email</th>
                      <th className="px-4 py-3 text-left font-medium">Role</th>
                      <th className="px-4 py-3 text-left font-medium">Joined</th>
                      <th className="px-4 py-3 text-right font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-accent/40">
                        <td className="px-4 py-3 font-medium">{user.fullName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                        <td className="px-4 py-3">
                          <Badge variant={user.role === "ADMIN" ? "info" : "secondary"}>
                            {user.role.toLowerCase()}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(user.createdAt)}</td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant={user.isActive ? "outline" : "default"}
                            size="sm"
                            disabled={busy || user.role === "ADMIN"}
                            onClick={() => void toggleUser(user)}
                          >
                            {user.isActive ? "Active" : "Disabled"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {settings.length === 0 ? (
              <EmptyState
                icon={<Settings2 className="h-6 w-6" />}
                title="No settings configured"
                description="Safety and platform settings will appear here."
              />
            ) : (
              settings.map((setting) => {
                const raw =
                  typeof setting.value === "string"
                    ? setting.value
                    : JSON.stringify(setting.value, null, 2);
                return (
                  <Card key={setting.key}>
                    <CardHeader>
                      <CardTitle className="text-base">{setting.key}</CardTitle>
                      <CardDescription>
                        {setting.updatedBy ? `Last updated by ${setting.updatedBy}` : "JSON value"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor={`setting-${setting.key}`}>Value (JSON)</Label>
                        <Input
                          id={`setting-${setting.key}`}
                          value={settingDrafts[setting.key] ?? raw}
                          onChange={(e) =>
                            setSettingDrafts((prev) => ({ ...prev, [setting.key]: e.target.value }))
                          }
                          className="font-mono text-xs"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setSettingDrafts((prev) => {
                              const next = { ...prev };
                              delete next[setting.key];
                              return next;
                            })
                          }
                        >
                          Reset
                        </Button>
                        <Button
                          size="sm"
                          className="gap-2"
                          disabled={busy}
                          onClick={() => void saveSetting(setting.key, settingDrafts[setting.key] ?? raw)}
                        >
                          {busy ? <Spinner /> : null}
                          Save
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
