"use client";

import { PageContainer } from "@/components/layout/page-container";
import { LogTable } from "@/components/logs/log-table";

export default function LogsPage() {
  return (
    <PageContainer
      title="Logs"
      description="Filterable activity history and system events"
    >
      <LogTable />
    </PageContainer>
  );
}
