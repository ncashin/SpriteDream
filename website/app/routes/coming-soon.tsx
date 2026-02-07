import { useState } from "react";
import type { Route } from "./+types/coming-soon";

export function meta({ }: Route.MetaArgs) {
    return [
        { title: "GameIDE — Coming Soon" },
        {
            name: "description",
            content: "GameIDE is launching soon. Join the waitlist and get early access.",
        },
    ];
}

export default function ComingSoon() {
    const [email, setEmail] = useState("");
    const isSubmitDisabled = email.trim().length === 0;

    return (
        <main className="min-h-screen bg-[var(--color-bg-void)] grid-bg text-white">
            <div className="spotlight fixed inset-0 pointer-events-none" />
            <div className="relative z-10 flex min-h-screen items-start justify-center pr-10 pl-0 pt-28 pb-16 sm:items-center sm:py-16 sm:px-10">
                <div className="w-full max-w-3xl">
                    <div className="">
                    <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                            <span className="block text-white">
                                GameIDE is coming soon
                            </span>
                            <span className="pt-2 pl-1 block text-lg font-medium text-white/70 sm:text-2xl">
                            Join the waitlist for early access
                            </span>
                        </h1>

                      
                    </div>


                    <form
                        className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
                        onSubmit={(event) => event.preventDefault()}
                    >
                        <input
                            type="email"
                            name="email"
                            placeholder="email@example.com"
                            autoComplete="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            className="h-12 min-h-12 w-full flex-1 appearance-none rounded-2xl border border-white/15 bg-[var(--color-bg-elevated)] px-4 text-[16px] font-medium leading-none text-white placeholder:text-white/50 shadow-[0_0_26px_rgba(90,110,255,0.22)] transition-all focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/70 focus:shadow-[0_0_40px_rgba(90,110,255,0.4)] sm:w-auto sm:text-base"
                            required
                        />
                        <button
                            type="submit"
                            disabled={isSubmitDisabled}
                            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-[var(--color-bg-elevated)] px-4 text-sm font-semibold text-white shadow-[0_0_26px_rgba(90,110,255,0.22)] transition-all hover:border-[var(--color-accent)] hover:shadow-[0_0_36px_rgba(90,110,255,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/70 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none sm:w-auto"
                        >
                            Notify me
                        </button>
                    </form>

                </div>
            </div>
        </main>
    );
}
