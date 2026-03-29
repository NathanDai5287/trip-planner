"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload, Share2, Link, Check, Trash2, Loader2 } from "lucide-react";
import type { Trip, Destination } from "@/lib/types";
import toast from "react-hot-toast";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { buildTripExport } from "@/lib/export";
import { importTripSchema } from "@/lib/import-schema";
import { toggleSharing, deleteTrip, addDestination } from "@/lib/firestore";

interface TripActionsProps {
  trip: Trip;
  destinations: Destination[];
  onImportComplete: (destinations: Destination[]) => void;
}

function ActionBtn({
  onClick,
  title,
  disabled,
  active,
  danger,
  children,
}: {
  onClick: () => void;
  title: string;
  disabled?: boolean;
  active?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        flex items-center justify-center h-7 w-7 rounded-md transition-colors cursor-pointer
        disabled:opacity-40 disabled:cursor-not-allowed
        ${danger
          ? "text-muted hover:text-danger hover:bg-danger/10"
          : active
            ? "text-terracotta bg-terracotta/10 hover:bg-terracotta/20"
            : "text-muted hover:text-charcoal hover:bg-stone-light"
        }
      `}
    >
      {children}
    </button>
  );
}

function TripActions({ trip, destinations, onImportComplete }: TripActionsProps) {
  const router = useRouter();
  const [isShared, setIsShared] = useState(trip.isPublic);
  const [shareSlug, setShareSlug] = useState(trip.shareSlug);
  const [isTogglingShare, setIsTogglingShare] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = useCallback(() => {
    try {
      const exportData = buildTripExport({ ...trip, destinations });
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${trip.title.toLowerCase().replace(/\s+/g, "-")}-trip.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Trip exported");
    } catch {
      toast.error("Failed to export trip");
    }
  }, [trip, destinations]);

  const handleImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setIsImporting(true);
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const parsed = importTripSchema.parse(json);
        const newDestinations: Destination[] = [];
        for (const dest of parsed.destinations) {
          const created = await addDestination(trip.id, {
            osmId: dest.osmId,
            name: dest.name,
            address: dest.address,
            lat: dest.lat,
            lng: dest.lng,
          });
          newDestinations.push(created);
        }
        onImportComplete([...destinations, ...newDestinations]);
        toast.success(`Imported ${newDestinations.length} destination${newDestinations.length !== 1 ? "s" : ""}`);
      } catch (err) {
        toast.error(err instanceof SyntaxError ? "Invalid JSON file" : "Failed to import trip data");
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [trip.id, destinations, onImportComplete],
  );

  const handleToggleShare = useCallback(async () => {
    setIsTogglingShare(true);
    try {
      const result = await toggleSharing(trip.id);
      setIsShared(result.isPublic);
      setShareSlug(result.shareSlug ?? null);
      toast.success(result.isPublic ? "Sharing enabled" : "Sharing disabled");
    } catch {
      toast.error("Failed to toggle sharing");
    } finally {
      setIsTogglingShare(false);
    }
  }, [trip.id]);

  const handleCopyLink = useCallback(async () => {
    if (!shareSlug) return;
    const url = `${window.location.origin}/trip/share/${shareSlug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  }, [shareSlug]);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      await deleteTrip(trip.id);
      router.push("/dashboard");
    } catch {
      toast.error("Failed to delete trip");
      setIsDeleting(false);
    }
  }, [trip.id, router]);

  return (
    <>
      <div className="flex items-center gap-0.5">
        <ActionBtn title="Export trip" onClick={handleExport}>
          <Download size={14} />
        </ActionBtn>

        <ActionBtn title="Import destinations" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
          {isImporting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        </ActionBtn>
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />

        <ActionBtn
          title={isShared ? "Disable sharing" : "Enable sharing"}
          onClick={handleToggleShare}
          disabled={isTogglingShare}
          active={isShared}
        >
          {isTogglingShare ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
        </ActionBtn>

        {isShared && shareSlug && (
          <ActionBtn title="Copy share link" onClick={handleCopyLink} active={copied}>
            {copied ? <Check size={14} /> : <Link size={14} />}
          </ActionBtn>
        )}

        <div className="flex-1" />

        <ActionBtn title="Delete trip" onClick={() => setShowDeleteModal(true)} danger>
          <Trash2 size={14} />
        </ActionBtn>
      </div>

      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete trip">
        <p className="text-sm text-muted mb-6">
          Are you sure you want to delete &ldquo;{trip.title}&rdquo;? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
          <Button variant="danger" size="sm" onClick={handleDelete} loading={isDeleting}>Delete trip</Button>
        </div>
      </Modal>
    </>
  );
}

export { TripActions };
