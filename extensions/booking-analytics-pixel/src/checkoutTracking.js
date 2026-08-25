import { CUSTOM_EVENTS } from "./events";

export function registerCheckoutTracking({
  analytics,
  init,
  settings,
}) {
  const apiUrl = settings?.apiUrl;

  if (!apiUrl) {
    console.error("Pixel apiUrl setting is missing");
    return;
  }

  console.log("CHECKOUT TRACKING INITIALIZED");

  analytics.subscribe("checkout_started", async (event) => {
    console.log("🔥 NATIVE CHECKOUT STARTED", event.id);

    const checkout = event.data?.checkout || {};

    await sendEvent(apiUrl, {
      event_type: "checkout_started",

      customer_id:
        init?.data?.customer?.id || null,

      customer_email:
        init?.data?.customer?.email ||
        checkout.email ||
        null,

      session_id: event.clientId || null,

      checkout_id:
        checkout.token ||
        checkout.id ||
        null,

      page_url:
        event.context?.window?.location?.href ||
        null,

      metadata: {
        status: "started",
        event_id: event.id || null,
        timestamp:
          event.timestamp ||
          new Date().toISOString(),
        source: "shopify_checkout_started",
      },
    });
  });

  analytics.subscribe("checkout_completed", async (event) => {
    console.log("🔥 NATIVE CHECKOUT COMPLETED", event.id);

    const checkout = event.data?.checkout || {};

    await sendEvent(apiUrl, {
      event_type: "checkout_completed",

      customer_id:
        init?.data?.customer?.id ||
        checkout?.order?.customer?.id ||
        null,

      customer_email:
        init?.data?.customer?.email ||
        checkout.email ||
        null,

      session_id: event.clientId || null,

      checkout_id:
        checkout.token ||
        checkout.id ||
        null,

      page_url:
        event.context?.window?.location?.href ||
        null,

      metadata: {
        status: "completed",
        event_id: event.id || null,
        timestamp:
          event.timestamp ||
          new Date().toISOString(),
        source: "shopify_checkout_completed",
      },
    });
  });
}

async function sendEvent(apiUrl, payload) {
  try {
    const response = await fetch(`${apiUrl}/api/analytics`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });

    const result = await response.json();

    console.log("CHECKOUT API RESPONSE", result);

    if (!response.ok) {
      console.error("❌ CHECKOUT ANALYTICS ERROR", result);
    }
  } catch (error) {
    console.error("❌ CHECKOUT FETCH ERROR", error);
  }
}