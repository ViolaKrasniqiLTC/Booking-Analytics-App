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

export function setupPageViewTracking(analytics, init, settings) {
  analytics.subscribe("page_viewed", (event) => {
    const customer = init?.data?.customer ?? null;
    const pageUrl = getPageUrl(init, event);

    console.log("Page viewed", {
      url: pageUrl,
      customerEmail: customer?.email ?? null,
      customerId: customer?.id ?? null,
      eventId: event.id,
    });

    if (!settings?.apiUrl) {
      console.log("Missing apiUrl pixel setting");
      return;
    }

    fetch(`${settings.apiUrl}/api/analytics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: "page_viewed",
          customer_id: customer?.id ?? null,
          customer_email: customer?.email ?? null,
          session_id: event.clientId,
          page_url: pageUrl,
          metadata: {
            event_id: event.id,
            timestamp: event.timestamp,
          },
        }),
        keepalive: true,
      }).catch((error) => {
        console.log("Failed to send page view", error);
      });
  });
}
