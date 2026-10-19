import { PriceError, priceService, requestedPair } from "../lib/prices.server";
export async function loader({ request }: { request: Request }) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const pair = requestedPair(new URL(request.url).searchParams.get("pair"));
    return Response.json(await priceService().getPrice(pair), { headers });
  } catch (error) {
    const failure =
      error instanceof PriceError
        ? error
        : new PriceError("Price service is unavailable.");
    return Response.json(
      { error: failure.message, retryAfter: failure.retryAfter },
      {
        status: failure.status,
        headers: { ...headers, "Retry-After": String(failure.retryAfter) },
      },
    );
  }
}
