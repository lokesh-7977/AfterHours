import { PageSkeleton } from "@/components/ui";

/** Streaming boundary for navigations within this section (session/data reads happen per request). */
export default function Loading() {
  return <PageSkeleton />;
}
