function getPageUrl(init, event) {
  try {
    return (
      init?.context?.document?.location?.href ??
      event?.context?.document?.location?.href ??
      null
    );
  } catch {
    return null;
  }
}

export function setupPageViewTracking(analytics, init) {
  analytics.subscribe("page_viewed", (event) => {
    const customer = init?.data?.customer ?? null;

    console.log("Page viewed", {
      url: getPageUrl(init, event),
      customerEmail: customer?.email ?? null,
      customerId: customer?.id ?? null,
      eventId: event.id,
    });
  });
}
