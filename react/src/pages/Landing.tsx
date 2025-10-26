import { motion } from "framer-motion";
import { ArrowRight, Bolt, Shield, Sparkles } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black text-white">
      {/* Nav */}
      <header className="sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-slate-900/60">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <a href="#home" className="flex items-center gap-2 font-semibold">
            <Sparkles className="h-5 w-5" />
            <span>Nova</span>
          </a>
          <div className="hidden gap-8 md:flex">
            <a className="opacity-80 hover:opacity-100" href="#features">Features</a>
            <a className="opacity-80 hover:opacity-100" href="#how">How it works</a>
            <a className="opacity-80 hover:opacity-100" href="#faq">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <a href="#" className="rounded-xl px-4 py-2 text-sm opacity-80 hover:opacity-100">Log in</a>
            <a
              href="#cta"
              className="rounded-2xl bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow hover:shadow-lg"
            >
              Get Started
            </a>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section id="home" className="relative mx-auto max-w-6xl px-4 pt-20 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs opacity-90">
            <Bolt className="h-3.5 w-3.5" /> New: Instant setup in under 60s
          </span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-6xl">
            Build a modern landing page in minutes
          </h1>
          <p className="mt-4 text-balance text-slate-300">
            A clean, responsive starter with animations, icons, and accessible components.
            Drop this into your Vite + React app and ship.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#cta"
              className="inline-flex items-center gap-2 rounded-2xl bg-indigo-500 px-5 py-3 font-medium text-white shadow hover:shadow-xl"
            >
              Start for free <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#features"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 font-medium text-white hover:bg-white/10"
            >
              See features
            </a>
          </div>
        </motion.div>

        {/* Glow */}
        <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
          <div className="h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          <Feature
            icon={<Sparkles className="h-5 w-5" />}
            title="Beautiful by default"
            desc="Tailwind utility classes and sensible spacing give you a crisp, modern look."
          />
          <Feature
            icon={<Shield className="h-5 w-5" />}
            title="Accessible"
            desc="Semantic HTML, focusable buttons/links, and high-contrast colors baked in."
          />
          <Feature
            icon={<Bolt className="h-5 w-5" />}
            title="Fast"
            desc="Vite-powered dev server and production build for snappy performance."
          />
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold">How it works</h2>
        <ol className="mx-auto mt-8 grid max-w-3xl gap-4 md:grid-cols-3">
          <li className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm font-semibold opacity-90">1. Copy</p>
            <p className="mt-2 text-sm text-slate-300">Copy this component into your project (e.g., <code>App.tsx</code>).</p>
          </li>
          <li className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm font-semibold opacity-90">2. Customize</p>
            <p className="mt-2 text-sm text-slate-300">Update brand name, colors, and sections to match your product.</p>
          </li>
          <li className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm font-semibold opacity-90">3. Ship</p>
            <p className="mt-2 text-sm text-slate-300">Deploy with Vercel/Netlify or your host of choice—done.</p>
          </li>
        </ol>
      </section>

      {/* CTA */}
      <section id="cta" className="mx-auto max-w-6xl px-4 py-24">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-600 to-blue-600 p-8 text-center shadow-2xl">
          <h3 className="text-2xl font-bold">Ready to launch?</h3>
          <p className="mt-2 text-white/90">Spin up a beautiful landing page and iterate quickly.</p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="#" className="rounded-2xl bg-white px-5 py-3 font-medium text-slate-900 shadow hover:shadow-xl">
              Create your account
            </a>
            <a href="#features" className="rounded-2xl border border-white/30 bg-white/10 px-5 py-3 font-medium text-white hover:bg-white/20">
              Learn more
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto max-w-6xl px-4 pb-10 text-sm text-white/60">
        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 md:flex-row">
          <p>© {new Date().getFullYear()} Nova Labs</p>
          <div className="flex items-center gap-5">
            <a className="hover:text-white" href="#">Privacy</a>
            <a className="hover:text-white" href="#">Terms</a>
            <a className="hover:text-white" href="#">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow"
    >
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
        {icon}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-slate-300">{desc}</p>
    </motion.div>
  );
}
