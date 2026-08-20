import { CUSTOM_EVENTS } from "./events";

export function setupPageViewTracking(analytics, init, settings) {
  console.log("Listening for page views via", CUSTOM_EVENTS.customerIdentified);

  analytics.subscribe(CUSTOM_EVENTS.customerIdentified, (event) => {
    const customData = event.customData ?? {};
    const customer = init?.data?.customer ?? null;

    const customerEmail = customData.email ?? customer?.email ?? null;
    const customerId = customData.customer_id ?? customer?.id ?? null;
    const pageUrl =
      customData.page_url ??
      init?.context?.document?.location?.href ??
      event?.context?.document?.location?.href ??
      null;

    console.log("Page viewed", {
      url: pageUrl,
      customerEmail,
      customerId,
      template: customData.template ?? null,
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
        customer_id: customerId,
        customer_email: customerEmail,
        session_id: event.clientId,
        page_url: pageUrl,
        metadata: {
          event_id: event.id,
          timestamp: event.timestamp,
          template: customData.template ?? null,
        },
      }),
      keepalive: true,
    }).catch((error) => {
      console.log("Failed to send page view", error);
    });
  });
}
