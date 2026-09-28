"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Bot,
  ClipboardList,
  MessageSquare,
  ShieldAlert,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageLoader } from "@/components/ui/feedback";
import { http } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import type { Conversation, SymptomCheck } from "@/types";

export default function DashboardPage() {
  const { user } = useAuth();
  const [checks, setChecks] = useState<SymptomCheck[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [checksRes, conversationsRes] = await Promise.allSettled([
        http.get<SymptomCheck[]>("/api/symptoms/history"),
        http.get<Conversation[]>("/api/chat/conversations"),
      ]);
      if (checksRes.status === "fulfilled") setChecks(checksRes.value.slice(0, 4));
      if (conversationsRes.status === "fulfilled") setConversations(conversationsRes.value.slice(0, 4));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">
              {user?.fullName ? `Hello, ${user.fullName.split(" ")[0]}` : "Dashboard"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Welcome to your AI Health Assistant. Ask questions or run a symptom check.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/chat">
              <Button className="gap-2">
                <Bot className="h-4 w-4" />
                Ask AI Assistant
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
              <Card className="transition-all hover:shadow-sm">
                <CardHeader className="flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">Ask AI Assistant</CardTitle>
                  <Bot className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">Groq LLM</p>
                  <p className="text-xs text-muted-foreground mt-1">Streaming Q&A Chatbot</p>
                  <Link href="/chat" className="mt-3 inline-flex items-center text-xs font-medium text-primary hover:underline">
                    Start conversation <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </CardContent>
              </Card>

              <Card className="transition-all hover:shadow-sm">
                <CardHeader className="flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">Symptom Checker</CardTitle>
                  <Stethoscope className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{checks.length} Checks</p>
                  <p className="text-xs text-muted-foreground mt-1">Guided assessments</p>
                  <Link href="/symptoms" className="mt-3 inline-flex items-center text-xs font-medium text-primary hover:underline">
                    Run symptom check <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </CardContent>
              </Card>

              <Card className="transition-all hover:shadow-sm">
                <CardHeader className="flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">Safety Engine</CardTitle>
                  <ShieldAlert className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">Active</p>
                  <p className="text-xs text-muted-foreground mt-1">Red-flag emergency detection</p>
                  <span className="mt-3 inline-block text-xs text-emerald-600 font-medium">
                    ✓ Real-time protection
                  </span>
                </CardContent>
              </Card>

              <Card className="transition-all hover:shadow-sm">
                <CardHeader className="flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">Health Profile</CardTitle>
                  <UserRound className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">Configured</p>
                  <p className="text-xs text-muted-foreground mt-1">Personalized advice context</p>
                  <Link href="/profile" className="mt-3 inline-flex items-center text-xs font-medium text-primary hover:underline">
                    Edit profile <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle>Recent AI Conversations</CardTitle>
                    <CardDescription>Your Q&A chat history with the assistant</CardDescription>
                  </div>
                  <Link href="/history" className="text-sm font-medium text-primary hover:underline">
                    View all
                  </Link>
                </CardHeader>
                <CardContent className="space-y-3">
                  {conversations.length === 0 ? (
                    <EmptyState
                      icon={<MessageSquare className="h-6 w-6" />}
                      title="No conversations yet"
                      description="Start a chat with the assistant to ask health-related questions."
                      action={
                        <Link href="/chat">
                          <Button size="sm">Start a conversation</Button>
                        </Link>
                      }
                    />
                  ) : (
                    conversations.map((conv) => (
                      <Link
                        key={conv.id}
                        href="/chat"
                        className="flex items-center justify-between rounded-lg border p-3.5 transition-colors hover:bg-accent/50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate text-sm">{conv.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDate(conv.updatedAt ?? conv.createdAt)} · {conv.messageCount} messages
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 ml-3" />
                      </Link>
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
                    { href: "/profile", label: "Update health profile", icon: UserRound },
                    { href: "/history", label: "Review past activity", icon: ClipboardList },
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
