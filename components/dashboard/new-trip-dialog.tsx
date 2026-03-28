"use client";

import { useRef, useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createTrip } from "@/app/actions/trips";

interface NewTripDialogProps {
  open: boolean;
  onClose: () => void;
}

function NewTripDialog({ open, onClose }: NewTripDialogProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createTrip(formData);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  function handleClose() {
    setError(null);
    formRef.current?.reset();
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="New Trip">
      <form ref={formRef} action={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Trip Title"
          name="title"
          placeholder="e.g. Pacific Coast Highway"
          required
          autoFocus
          error={error ?? undefined}
        />
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="description"
            className="text-sm font-medium text-charcoal font-body"
          >
            Description (optional)
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            placeholder="A few words about your trip..."
            className="w-full rounded-lg border border-border bg-cream px-4 py-2.5 text-sm text-charcoal font-body placeholder:text-muted transition-colors duration-150 focus:bg-stone-light focus:border-terracotta focus:ring-2 focus:ring-terracotta/20 focus:outline-none resize-none"
          />
        </div>
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" loading={isPending}>
            Create Trip
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export { NewTripDialog };
