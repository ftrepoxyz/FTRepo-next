"use client";

import { PageContainer } from "@/components/layout/page-container";
import { SettingsPanel } from "@/components/settings/settings-panel";

export default function SettingsPage() {
  return (
    <PageContainer
      title="Settings"
      description="Configure source metadata, channels, and admin actions"
    >
      <SettingsPanel />
    </PageContainer>
  );
}
