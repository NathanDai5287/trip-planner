"use client";

import { useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { deleteTrip } from "@/app/actions/trips";

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
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await deleteTrip(tripId);
    });
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
