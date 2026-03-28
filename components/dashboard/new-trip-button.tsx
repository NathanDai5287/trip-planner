"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewTripDialog } from "@/components/dashboard/new-trip-dialog";

function NewTripButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="primary" size="md" onClick={() => setOpen(true)}>
        <Plus size={18} />
        New Trip
      </Button>
      <NewTripDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export { NewTripButton };
