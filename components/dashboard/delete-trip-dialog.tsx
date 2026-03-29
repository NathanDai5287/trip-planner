"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { deleteTrip } from "@/lib/firestore";
import toast from "react-hot-toast";

interface DeleteTripDialogProps {
  tripId: string;
  tripTitle: string;
  open: boolean;
  onClose: () => void;
}

function DeleteTripDialog({
  tripId,
  tripTitle,
  open,
  onClose,
}: DeleteTripDialogProps) {
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    setIsPending(true);
    try {
      await deleteTrip(tripId);
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Failed to delete trip");
      setIsPending(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Delete Trip">
      <div className="flex flex-col gap-5">
        <p className="text-sm text-muted font-body leading-relaxed">
          Are you sure you want to delete{" "}
          <span className="font-semibold text-charcoal">{tripTitle}</span>? This
          will permanently remove the trip and all its destinations. This action
          cannot be undone.
        </p>
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            loading={isPending}
            onClick={handleDelete}
          >
            Delete Trip
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export { DeleteTripDialog };
export type { DeleteTripDialogProps };
