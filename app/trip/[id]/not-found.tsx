import Link from "next/link";
import { MapPinOff } from "lucide-react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";

export default function TripNotFound() {
  return (
    <div className="flex flex-col h-screen">
      <Header />
      <div className="flex flex-1 items-center justify-center bg-cream">
        <div className="text-center max-w-md px-6">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-stone">
            <MapPinOff size={36} className="text-muted" />
          </div>
          <h1 className="font-display text-3xl font-semibold text-charcoal mb-3">
            Trip not found
          </h1>
          <p className="text-muted mb-8">
            This trip doesn&apos;t exist or you don&apos;t have permission to
            view it. It may have been deleted or the link might be incorrect.
          </p>
          <Link href="/dashboard">
            <Button variant="primary" size="lg">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
