"use client";

import { PageContainer } from "@/components/layout/page-container";
import { IpaTable } from "@/components/database/ipa-table";

export default function DatabasePage() {
  return (
    <PageContainer
      title="Database"
      description="IPA catalog — search, view, and manage all processed apps"
    >
      <IpaTable />
    </PageContainer>
  );
}
