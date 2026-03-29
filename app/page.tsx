import Link from "next/link";
import { Compass, Map, Route, Share2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Map,
    title: "Interactive Maps",
    description:
      "Visualize your entire route on a beautiful, interactive map powered by OpenStreetMap data.",
  },
  {
    icon: Route,
    title: "Smart Routing",
    description:
      "Optimize your stops and get turn-by-turn directions with intelligent route planning.",
  },
  {
    icon: Share2,
    title: "Collaborative Planning",
    description:
      "Invite friends and family to help plan. Share trips and edit itineraries together in real time.",
  },
  {
    icon: Download,
    title: "Export Anywhere",
    description:
      "Download your itinerary as a PDF or share a public link so everyone stays on the same page.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center px-4 pt-32 pb-24 sm:pt-40 sm:pb-32 overflow-hidden">
        {/* Topographic background */}
        <div className="topo-pattern absolute inset-0 pointer-events-none" aria-hidden="true" />

        <div className="relative z-10 mx-auto max-w-3xl text-center stagger-children">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-cream px-4 py-1.5 text-xs font-body text-muted shadow-sm mb-8">
            <Compass size={14} className="text-terracotta" />
            Plan. Drive. Discover.
          </div>

          <h1 className="font-display text-5xl font-bold leading-tight tracking-tight text-charcoal sm:text-6xl lg:text-7xl">
            Chart Your Next{" "}
            <span className="text-terracotta">Adventure</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted font-body">
            Plan road trips with an interactive map, smart routing, and
            drag-and-drop itineraries. Your next great journey starts here.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/dashboard">
              <Button variant="primary" size="lg">
                Start Planning
              </Button>
            </Link>
          </div>
        </div>

        {/* Decorative gradient fade at the bottom */}
        <div
          className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent"
          aria-hidden="true"
        />
      </section>

      {/* Features */}
      <section className="relative px-4 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <div className="text-center stagger-children">
            <h2 className="font-display text-3xl font-bold tracking-tight text-charcoal sm:text-4xl">
              Everything You Need for the Open Road
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base text-muted font-body">
              From first idea to final mile, Wayfinder keeps your road trip organized and fun.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 stagger-children">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-xl border border-border bg-cream p-6 shadow-sm transition-shadow duration-200 hover:shadow-md"
              >
                <div className="mb-4 inline-flex items-center justify-center rounded-lg bg-stone-light p-3">
                  <feature.icon
                    size={24}
                    className="text-terracotta transition-transform duration-200 group-hover:scale-110"
                  />
                </div>
                <h3 className="font-display text-lg font-semibold text-charcoal">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted font-body">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-3xl rounded-2xl bg-charcoal px-8 py-14 text-center shadow-lg sm:px-16 stagger-children">
          <h2 className="font-display text-3xl font-bold text-cream sm:text-4xl">
            Ready to Hit the Road?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base text-stone font-body">
            Start mapping your next adventure in minutes.
          </p>
          <div className="mt-8">
            <Link href="/dashboard">
              <Button variant="primary" size="lg">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <Compass size={18} className="text-terracotta" />
            <span className="font-display text-sm font-medium text-charcoal">
              Wayfinder
            </span>
          </div>
          <p className="text-xs text-muted font-body text-center">
            Map data &copy; <a href="https://www.openstreetmap.org/copyright" className="underline hover:text-charcoal transition-colors" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors. Routing by OSRM.
          </p>
          <p className="text-xs text-muted font-body">
            &copy; {new Date().getFullYear()} Wayfinder
          </p>
        </div>
      </footer>
    </div>
  );
}
