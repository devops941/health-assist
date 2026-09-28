"use client";

import * as React from "react";
import { AlertTriangle, Phone, Siren } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RedFlag } from "@/types";

const SEVERITY_STYLES: Record<string, string> = {
  critical: "border-destructive/40 bg-destructive/10 text-destructive",
  high: "border-destructive/40 bg-destructive/10 text-destructive",
  moderate: "border-amber-300 bg-amber-50 text-amber-900",
  low: "border-sky-300 bg-sky-50 text-sky-900",
};

export function RedFlagAlert({ redFlag, className }: { redFlag?: RedFlag | null; className?: string }) {
  if (!redFlag?.triggered) return null;

  const style = SEVERITY_STYLES[redFlag.severity] ?? SEVERITY_STYLES.moderate;
  const isCritical = redFlag.severity === "critical" || redFlag.severity === "high";

  return (
    <div
      role="alert"
      className={cn("animate-fade-in rounded-lg border-2 p-4", style, className)}
    >
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", isCritical ? "bg-destructive text-destructive-foreground" : "bg-amber-500 text-white")}>
          {isCritical ? <Siren className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {isCritical ? "This may need urgent medical attention" : "Worth checking with a professional"}
          </p>
          {redFlag.advice && <p className="mt-1 text-sm">{redFlag.advice}</p>}

          {redFlag.labels.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {redFlag.labels.map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-current/20 bg-background/60 px-2 py-0.5 text-xs font-medium"
                >
                  {label}
                </span>
              ))}
            </div>
          )}

          {isCritical && Object.keys(redFlag.emergency_numbers).length > 0 && (
            <div className="mt-3 rounded-md border border-current/20 bg-background/70 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                <Phone className="h-3.5 w-3.5" />
                Emergency numbers
              </p>
              <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
                {Object.entries(redFlag.emergency_numbers).map(([region, number]) => (
                  <div key={region} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{region}</span>
                    <span className="font-medium tabular-nums">{number}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
