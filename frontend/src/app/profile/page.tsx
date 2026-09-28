"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Plus, Save, ShieldCheck, UserRound, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { PageLoader, Spinner } from "@/components/ui/feedback";
import { http } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import type { HealthProfile } from "@/types";

const ACTIVITY_LEVELS = ["sedentary", "light", "moderate", "active", "very_active"];
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown"];

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [listInput, setListInput] = useState<Record<string, string>>({
    allergies: "",
    conditions: "",
    medications: "",
  });

  const load = useCallback(async () => {
    try {
      setProfile(await http.get<HealthProfile>("/api/profile"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const updated = await http.put<HealthProfile>("/api/profile", {
        age: profile.age ?? undefined,
        gender: profile.gender ?? undefined,
        heightCm: profile.heightCm ?? undefined,
        weightKg: profile.weightKg ?? undefined,
        bloodGroup: profile.bloodGroup ?? undefined,
        allergies: profile.allergies,
        conditions: profile.conditions,
        medications: profile.medications,
        activityLevel: profile.activityLevel ?? undefined,
      });
      setProfile(updated);
      setMessage("Profile saved. Your AI guidance will use these details.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  };

  const addToList = (field: "allergies" | "conditions" | "medications") => {
    const value = listInput[field]?.trim();
    if (!value || !profile) return;
    if (profile[field].includes(value)) {
      setListInput({ ...listInput, [field]: "" });
      return;
    }
    setProfile({ ...profile, [field]: [...profile[field], value] });
    setListInput({ ...listInput, [field]: "" });
  };

  const removeFromList = (field: "allergies" | "conditions" | "medications", value: string) => {
    if (!profile) return;
    setProfile({ ...profile, [field]: profile[field].filter((item) => item !== value) });
  };

  const bmi = (() => {
    if (!profile?.heightCm || !profile?.weightKg) return null;
    const heightM = profile.heightCm / 100;
    return profile.weightKg / (heightM * heightM);
  })();

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Health Profile</h1>
          <p className="text-sm text-muted-foreground">
            These details help the assistant give more relevant, safer guidance.
          </p>
        </div>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserRound className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="font-medium">{user?.fullName}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
            <Badge variant="secondary" className="ml-auto capitalize">
              {user?.role.toLowerCase()}
            </Badge>
          </CardContent>
        </Card>

        {loading ? (
          <PageLoader />
        ) : !profile ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error || "Could not load your profile."}
          </div>
        ) : (
          <form onSubmit={save} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic details</CardTitle>
                <CardDescription>Used to interpret symptoms and wellness data.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="age">Age</Label>
                  <Input
                    id="age"
                    type="number"
                    min="0"
                    max="120"
                    value={profile.age ?? ""}
                    onChange={(e) =>
                      setProfile({ ...profile, age: e.target.value ? Number(e.target.value) : null })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <Input
                    id="gender"
                    value={profile.gender ?? ""}
                    onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
                    placeholder="e.g. female"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height">Height (cm)</Label>
                  <Input
                    id="height"
                    type="number"
                    step="0.1"
                    value={profile.heightCm ?? ""}
                    onChange={(e) =>
                      setProfile({ ...profile, heightCm: e.target.value ? Number(e.target.value) : null })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weight">Weight (kg)</Label>
                  <Input
                    id="weight"
                    type="number"
                    step="0.1"
                    value={profile.weightKg ?? ""}
                    onChange={(e) =>
                      setProfile({ ...profile, weightKg: e.target.value ? Number(e.target.value) : null })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="blood">Blood group</Label>
                  <Select
                    id="blood"
                    value={profile.bloodGroup ?? "unknown"}
                    onChange={(e) => setProfile({ ...profile, bloodGroup: e.target.value })}
                  >
                    {BLOOD_GROUPS.map((group) => (
                      <option key={group} value={group}>
                        {group}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="activity">Activity level</Label>
                  <Select
                    id="activity"
                    value={profile.activityLevel ?? "moderate"}
                    onChange={(e) => setProfile({ ...profile, activityLevel: e.target.value })}
                  >
                    {ACTIVITY_LEVELS.map((level) => (
                      <option key={level} value={level} className="capitalize">
                        {level.replace("_", " ")}
                      </option>
                    ))}
                  </Select>
                </div>
                {bmi && (
                  <div className="sm:col-span-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Body mass index (BMI): </span>
                    <span className="font-medium tabular-nums">{bmi.toFixed(1)}</span>
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      — a general reference, not a diagnosis.
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {(["allergies", "conditions", "medications"] as const).map((field) => (
              <Card key={field}>
                <CardHeader>
                  <CardTitle className="capitalize">
                    {field === "conditions" ? "Existing conditions" : field}
                  </CardTitle>
                  <CardDescription>
                    {field === "allergies"
                      ? "Allergies the assistant should always consider."
                      : field === "conditions"
                        ? "Long-term conditions that affect guidance."
                        : "Medicines you currently take."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      value={listInput[field]}
                      onChange={(e) => setListInput({ ...listInput, [field]: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addToList(field);
                        }
                      }}
                      placeholder={`Add ${field === "conditions" ? "a condition" : field.slice(0, -1)}`}
                    />
                    <Button type="button" variant="outline" size="icon" onClick={() => addToList(field)} aria-label={`Add ${field}`}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {profile[field].length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nothing added yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {profile[field].map((item) => (
                        <span
                          key={item}
                          className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium"
                        >
                          {item}
                          <button type="button" onClick={() => removeFromList(field, item)} aria-label={`Remove ${item}`}>
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {message && (
              <div className="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                <ShieldCheck className="h-4 w-4" />
                {message}
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? <Spinner /> : <Save className="h-4 w-4" />}
                Save profile
              </Button>
            </div>
          </form>
        )}
      </div>
    </AppShell>
  );
}
