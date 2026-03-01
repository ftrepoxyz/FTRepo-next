"use client";

import { PageContainer } from "@/components/layout/page-container";
import {
  DownloadChart,
  ChannelChart,
  StorageChart,
} from "@/components/metrics/charts";

export default function MetricsPage() {
  return (
    <PageContainer
      title="Metrics"
      description="Download statistics, channel activity, and storage usage"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <DownloadChart />
        <ChannelChart />
      </div>
      <StorageChart />
    </PageContainer>
  );
}
