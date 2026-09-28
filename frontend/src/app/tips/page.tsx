"use client";

import { useCallback, useEffect, useState } from "react";
import { Lightbulb, RefreshCw, Sparkles, Target } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageLoader, Spinner } from "@/components/ui/feedback";
import { http } from "@/lib/api";
import type { WellnessTips } from "@/types";

export default function TipsPage() {
  const [tips, setTips] = useState<WellnessTips | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError("");
    try {
      setTips(await http.get<WellnessTips>("/api/wellness/tips"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate tips right now.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">AI Wellness Tips</h1>
            <p className="text-sm text-muted-foreground">
              Personalised suggestions based on your recent wellness logs.
            </p>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => void load(true)}
            disabled={refreshing}
          >
            {refreshing ? <Spinner /> : <RefreshCw className="h-4 w-4" />}
            Regenerate
          </Button>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <PageLoader label="Reviewing your wellness data..." />
        ) : !tips ? (
          <EmptyState
            icon={<Sparkles className="h-6 w-6" />}
            title="No tips available yet"
            description="Log a few days of wellness data, then come back for personalised suggestions."
          />
        ) : (
          <>
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>{tips.headline || "Your wellness focus"}</CardTitle>
                    {tips.focus_area && (
                      <CardDescription className="flex items-center gap-1.5">
                        <Target className="h-3.5 w-3.5" />
                        Focus area: <span className="capitalize">{tips.focus_area}</span>
                      </CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
              {tips.tips.map((tip, index) => (
                <Card key={index} className="animate-fade-in">
                  <CardContent className="p-5">
                    <div className="mb-2 flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                        <Lightbulb className="h-4 w-4" />
                      </div>
                      <Badge variant="secondary" className="capitalize">
                        {tip.area}
                      </Badge>
                    </div>
                    <p className="text-sm leading-relaxed">{tip.tip}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <p className="text-center text-xs text-muted-foreground">
              These tips are general wellness suggestions and are not medical advice. Talk to a
              doctor before changing your treatment plan.
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}
