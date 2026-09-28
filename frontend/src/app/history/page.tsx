"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bot,
  ClipboardList,
  MessageSquare,
  Stethoscope,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageLoader } from "@/components/ui/feedback";
import { Tabs } from "@/components/ui/tabs";
import { http } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { Conversation, SymptomCheck } from "@/types";

export default function HistoryPage() {
  const [tab, setTab] = useState("checks");
  const [checks, setChecks] = useState<SymptomCheck[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [checksRes, conversationsRes] = await Promise.all([
        http.get<SymptomCheck[]>("/api/symptoms/history"),
        http.get<Conversation[]>("/api/chat/conversations"),
      ]);
      setChecks(checksRes);
      setConversations(conversationsRes);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const removeCheck = async (id: string) => {
    setChecks((prev) => prev.filter((check) => check.id !== id));
    try {
      await http.del(`/api/symptoms/history/${id}`);
    } catch {
      await load();
    }
  };

  const removeConversation = async (id: string) => {
    setConversations((prev) => prev.filter((conversation) => conversation.id !== id));
    try {
      await http.del(`/api/chat/conversations/${id}`);
    } catch {
      await load();
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">History</h1>
          <p className="text-sm text-muted-foreground">
            Everything you have tracked with the assistant, in one place.
          </p>
        </div>

        <Tabs
          value={tab}
          onValueChange={setTab}
          tabs={[
            {
              value: "checks",
              label: `Symptom checks (${checks.length})`,
              icon: <Stethoscope className="h-4 w-4" />,
            },
            {
              value: "chats",
              label: `Conversations (${conversations.length})`,
              icon: <MessageSquare className="h-4 w-4" />,
            },
          ]}
        />

        {loading ? (
          <PageLoader />
        ) : tab === "checks" ? (
          checks.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="h-6 w-6" />}
              title="No symptom checks yet"
              description="Completed symptom checks will be listed here."
            />
          ) : (
            <div className="space-y-3">
              {checks.map((check) => (
                <Card key={check.id}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium capitalize">{check.symptoms.join(", ")}</p>
                          <Badge
                            variant={
                              check.urgency === "emergency" || check.urgency === "urgent"
                                ? "destructive"
                                : check.urgency === "soon"
                                  ? "warning"
                                  : "secondary"
                            }
                          >
                            {check.urgency.replace("_", " ")}
                          </Badge>
                          {check.redFlag && <Badge variant="destructive">red flag</Badge>}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDate(check.createdAt)}
                          {check.duration ? ` · ${check.duration}` : ""}
                          {check.severity ? ` · ${check.severity}` : ""}
                        </p>
                        {check.summary && (
                          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                            {check.summary}
                          </p>
                        )}
                        {check.possibleCauses.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {check.possibleCauses.slice(0, 4).map((cause, index) => (
                              <span
                                key={index}
                                className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                              >
                                {cause}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => void removeCheck(check.id)}
                        className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                        aria-label="Delete symptom check"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        ) : conversations.length === 0 ? (
          <EmptyState
            icon={<Bot className="h-6 w-6" />}
            title="No conversations yet"
            description="Your AI health Q&A conversations will appear here."
          />
        ) : (
          <div className="space-y-3">
            {conversations.map((conversation) => (
              <Card key={conversation.id}>
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{conversation.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(conversation.updatedAt ?? conversation.createdAt)} ·{" "}
                      {conversation.messageCount} messages
                    </p>
                    {conversation.preview && (
                      <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                        {conversation.preview}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => void removeConversation(conversation.id)}
                    className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                    aria-label="Delete conversation"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
