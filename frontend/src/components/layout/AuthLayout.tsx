"use client";

import Link from "next/link";
import { HeartPulse, ShieldCheck, Sparkles, Stethoscope } from "lucide-react";

const HIGHLIGHTS = [
  {
    icon: Stethoscope,
    title: "Symptom checker",
    body: "Describe how you feel and get structured guidance on likely causes, self-care and when to see a doctor.",
  },
  {
    icon: Sparkles,
    title: "AI health Q&A",
    body: "Ask everyday health questions and get clear, plain-language answers grounded in your health profile.",
  },
  {
    icon: ShieldCheck,
    title: "Safety first",
    body: "Automatic red-flag detection surfaces emergency guidance the moment a serious symptom appears.",
  },
];

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.35) 0, transparent 45%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.25) 0, transparent 40%)",
          }}
        />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <HeartPulse className="h-6 w-6" />
          </div>
          <div>
            <p className="text-base font-semibold">AI Health Assistant</p>
            <p className="text-xs text-primary-foreground/70">
              Health Questions · Symptom Check · Wellness
            </p>
          </div>
        </div>

        <div className="relative space-y-6">
          <h1 className="text-3xl font-semibold leading-tight">
            Clearer answers about your health, whenever you need them.
          </h1>
          <p className="max-w-md text-sm text-primary-foreground/80">
            Track how you are doing day to day, understand your symptoms, and build healthier
            habits — with guidance you can actually act on.
          </p>
          <ul className="space-y-4">
            {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs text-primary-foreground/75">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-primary-foreground/60">
          General health information only. Not a diagnosis and not a substitute for a doctor.
        </p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <HeartPulse className="h-5 w-5" />
            </div>
            <span className="text-sm font-semibold">AI Health Assistant</span>
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}
