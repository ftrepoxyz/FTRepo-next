"use client";

import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { LibraryTable } from "@/components/library/library-table";

export default function LibraryPage() {
  return (
    <PageContainer
      title="Library"
      description="Manage published IPAs — rename, delete, and regenerate source files"
    >
      <Suspense>
        <LibraryTable />
      </Suspense>
    </PageContainer>
  );
}
