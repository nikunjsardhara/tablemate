import { Suspense } from "react";
import { LoadingScreen } from "@/components/ui";
import { ListingView } from "./listing-view";

/**
 * Server wrapper. `params` is request-time state and this route is reached by
 * QR scan (a direct navigation), so it opts out of instant-navigation
 * validation and resolves the id before rendering the client view.
 */
export const instant = false;

export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<LoadingScreen />}>
      <ListingView id={id} />
    </Suspense>
  );
}
