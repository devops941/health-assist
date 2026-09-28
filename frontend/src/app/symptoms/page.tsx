"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Info,
  Plus,
  Stethoscope,
  X,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { RedFlagAlert } from "@/components/health/RedFlagAlert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { EmptyState, Spinner } from "@/components/ui/feedback";
import { http } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { RedFlag, SymptomCheck } from "@/types";

interface Question {
  id: string;
  question: string;
  type: string;
  options?: string[];
}

const URGENCY_VARIANT: Record<string, "destructive" | "warning" | "info" | "success" | "secondary"> = {
  emergency: "destructive",
  urgent: "destructive",
  soon: "warning",
  routine: "info",
  self_care: "success",
};

export default function SymptomsPage() {
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [symptomInput, setSymptomInput] = useState("");
  const [duration, setDuration] = useState("");
  const [severity, setSeverity] = useState("mild");
  const [notes, setNotes] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SymptomCheck | null>(null);
  const [redFlag, setRedFlag] = useState<RedFlag | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<SymptomCheck[]>([]);

  const loadHistory = useCallback(async () => {
    try {
      setHistory(await http.get<SymptomCheck[]>("/api/symptoms/history"));
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    void loadHistory();
    http
      .get<{ questions: Question[] }>("/api/symptoms/questions")
      .then((res) => setQuestions(res.questions ?? []))
      .catch(() => setQuestions([]));
  }, [loadHistory]);

  const addSymptom = () => {
    const value = symptomInput.trim().toLowerCase();
    if (!value || symptoms.includes(value)) {
      setSymptomInput("");
      return;
    }
    setSymptoms((prev) => [...prev, value]);
    setSymptomInput("");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setResult(null);
    setRedFlag(null);

    if (symptoms.length === 0) {
      setError("Add at least one symptom before running the check.");
      return;
    }

    setBusy(true);
    try {
      const response = await http.post<SymptomCheck & { redFlagDetail?: RedFlag }>(
        "/api/symptoms/check",
        { symptoms, duration: duration || undefined, severity, notes: notes || undefined, answers },
      );
      setResult(response);
      if (response.redFlag && response.redFlagDetail) setRedFlag(response.redFlagDetail);
      else if (response.redFlag) {
        setRedFlag({
          triggered: true,
          severity: response.urgency === "emergency" ? "critical" : "high",
          matched_rules: [],
          labels: ["urgent"],
          advice: response.whenToSeeDoctor ?? "",
          emergency_numbers: { US: "911", IN: "112 / 108 (ambulance)", UK: "999", EU: "112", AU: "000" },
        });
      }
      void loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not run the symptom check.");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setSymptoms([]);
    setDuration("");
    setSeverity("mild");
    setNotes("");
    setAnswers({});
    setResult(null);
    setRedFlag(null);
    setError("");
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Symptom Checker</h1>
          <p className="text-sm text-muted-foreground">
            Tell us what you are feeling. You will get likely causes, self-care steps and clear
            guidance on when to see a doctor.
          </p>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            This is not a diagnosis. If you have severe or worsening symptoms, chest pain, trouble
            breathing, or heavy bleeding, seek emergency care immediately.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Describe your symptoms</CardTitle>
              <CardDescription>Add one or more symptoms, then answer a few questions.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="symptom">Symptoms</Label>
                  <div className="flex gap-2">
                    <Input
                      id="symptom"
                      value={symptomInput}
                      onChange={(e) => setSymptomInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addSymptom();
                        }
                      }}
                      placeholder="e.g. headache, sore throat"
                    />
                    <Button type="button" variant="outline" size="icon" onClick={addSymptom} aria-label="Add symptom">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {symptoms.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {symptoms.map((symptom) => (
                        <span
                          key={symptom}
                          className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium capitalize"
                        >
                          {symptom}
                          <button
                            type="button"
                            onClick={() => setSymptoms((prev) => prev.filter((s) => s !== symptom))}
                            aria-label={`Remove ${symptom}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="duration">How long?</Label>
                    <Input
                      id="duration"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      placeholder="e.g. 2 days"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="severity">Severity</Label>
                    <Select id="severity" value={severity} onChange={(e) => setSeverity(e.target.value)}>
                      <option value="mild">Mild</option>
                      <option value="moderate">Moderate</option>
                      <option value="severe">Severe</option>
                    </Select>
                  </div>
                </div>

                {questions.length > 0 && (
                  <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <ClipboardList className="h-4 w-4 text-primary" />
                      A few follow-up questions
                    </p>
                    {questions.map((question) => (
                      <div key={question.id} className="space-y-1.5">
                        <Label htmlFor={question.id} className="text-xs text-muted-foreground">
                          {question.question}
                        </Label>
                        {question.options?.length ? (
                          <Select
                            id={question.id}
                            value={answers[question.id] ?? ""}
                            onChange={(e) =>
                              setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))
                            }
                          >
                            <option value="">Select an option</option>
                            {question.options.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <Input
                            id={question.id}
                            value={answers[question.id] ?? ""}
                            onChange={(e) =>
                              setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))
                            }
                            placeholder="Your answer"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="notes">Anything else? (optional)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Recent travel, medications, or anything that might be relevant"
                  />
                </div>

                {error && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button type="submit" disabled={busy} className="gap-2">
                    {busy ? <Spinner /> : <Stethoscope className="h-4 w-4" />}
                    Run symptom check
                  </Button>
                  <Button type="button" variant="outline" onClick={reset}>
                    Clear
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {redFlag?.triggered && <RedFlagAlert redFlag={redFlag} />}

            {busy && !result ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                  <Spinner className="h-6 w-6 text-primary" />
                  <p className="text-sm">Analysing your symptoms...</p>
                </CardContent>
              </Card>
            ) : result ? (
              <Card className="animate-fade-in">
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle>Assessment</CardTitle>
                    <Badge variant={URGENCY_VARIANT[result.urgency] ?? "secondary"}>
                      {result.urgency.replace("_", " ")}
                    </Badge>
                  </div>
                  <CardDescription>{formatDate(result.createdAt)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {result.summary && (
                    <p className="rounded-md bg-muted/50 p-3 text-sm leading-relaxed">{result.summary}</p>
                  )}

                  {result.possibleCauses.length > 0 && (
                    <section>
                      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                        <Info className="h-4 w-4 text-primary" />
                        Possible causes
                      </h3>
                      <ul className="space-y-1.5 text-sm">
                        {result.possibleCauses.map((cause, index) => (
                          <li key={index} className="flex gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                            <span>{cause}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {result.selfCare.length > 0 && (
                    <section>
                      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        Self-care
                      </h3>
                      <ul className="space-y-1.5 text-sm">
                        {result.selfCare.map((step, index) => (
                          <li key={index} className="flex gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                            <span>{step}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {result.whenToSeeDoctor && (
                    <section>
                      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                        <Clock className="h-4 w-4 text-amber-600" />
                        When to see a doctor
                      </h3>
                      <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                        {result.whenToSeeDoctor}
                      </p>
                    </section>
                  )}

                  <p className="border-t pt-3 text-xs text-muted-foreground">
                    This assessment is general health information only and is not a diagnosis.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Your assessment will appear here</CardTitle>
                  <CardDescription>
                    Add your symptoms and run the check to see possible causes, self-care and when to
                    seek care.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <EmptyState
                    icon={<Stethoscope className="h-6 w-6" />}
                    title="Ready when you are"
                    description="Your results stay private to your account."
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Previous checks</CardTitle>
            <CardDescription>Your symptom check history</CardDescription>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <EmptyState
                icon={<ClipboardList className="h-6 w-6" />}
                title="No checks yet"
                description="Your completed symptom checks will be listed here."
              />
            ) : (
              <ul className="divide-y">
                {history.slice(0, 8).map((check) => (
                  <li key={check.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium capitalize">
                        {check.symptoms.join(", ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(check.createdAt)}
                        {check.duration ? ` · ${check.duration}` : ""}
                        {check.severity ? ` · ${check.severity}` : ""}
                      </p>
                    </div>
                    <Badge variant={URGENCY_VARIANT[check.urgency] ?? "secondary"}>
                      {check.urgency.replace("_", " ")}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
