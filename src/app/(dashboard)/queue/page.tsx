"use client";

import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { QueueTable } from "@/components/queue/queue-table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RotateCw } from "lucide-react";

export default function QueuePage() {
  const retryAll = async () => {
    const res = await fetch("/api/queue/retry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    const data = await res.json();
    if (data.success) {
      toast.success(data.message);
    }
  };

  return (
    <PageContainer
      title="Queue"
      description="Pending downloads, failed items, and batch operations"
      actions={
        <Button variant="outline" size="sm" onClick={retryAll}>
          <RotateCw className="mr-2 h-4 w-4" />
          Retry All Failed
        </Button>
      }
    >
      <Suspense>
        <QueueTable />
      </Suspense>
    </PageContainer>
  );
}
