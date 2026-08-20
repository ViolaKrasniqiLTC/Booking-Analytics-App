import { CUSTOM_EVENTS } from "./events";

export function registerAddToCart({ analytics, browser, init, settings }) {
  const apiUrl = settings.apiUrl;

  if (!apiUrl) {
    console.log("Pixel apiUrl setting is missing");
  }

  let emailFromCustomEvent = null;
  let customerIdFromCustomEvent = null;

  console.log("Pixel customer", {
    customer: init.data.customer,
    shopifyEmail: init.data.customer?.email ?? null,
  });

  analytics.subscribe(CUSTOM_EVENTS.customerIdentified, (event) => {
    emailFromCustomEvent = event.customData?.email || null;
    customerIdFromCustomEvent = event.customData?.customer_id || null;
    console.log("Custom identity event", {
      email: emailFromCustomEvent,
      customer_id: customerIdFromCustomEvent,
    });
  });

  analytics.subscribe(CUSTOM_EVENTS.productAddedToCart, async (event) => {
    const cartLine = event.data?.cartLine;
    const shopifyEmail = init.data.customer?.email || null;
    const customerEmail = emailFromCustomEvent || shopifyEmail;
    const customerId =
      customerIdFromCustomEvent || init.data.customer?.id || null;
    const cartId = await resolveCartId({ event, browser, init });

    console.log("Add to cart email check", {
      shopifyEmail,
      emailFromCustomEvent,
      using: customerEmail,
      cartId,
    });

    sendEvent(apiUrl, {
      event_type: CUSTOM_EVENTS.productAddedToCart,
      customer_id: customerId,
      customer_email: customerEmail,
      session_id: event.clientId,
      page_url: event.context?.window?.location?.href,
      product_id: cartLine?.merchandise?.product?.id,
      product_title: cartLine?.merchandise?.product?.title,
      quantity: cartLine?.quantity,
      cart_id: cartId,
      checkout_id: null,
      metadata: {
        eventId: event.id,
        timestamp: event.timestamp,
      },
    });
  });

  analytics.subscribe("checkout_started", async (event) => {
    const checkout = event.data?.checkout;
    const shopifyEmail = init.data.customer?.email || null;
    const checkoutEmail = checkout?.email || null;
    const cartId = await resolveCartId({ event, browser, init });

    sendEvent(apiUrl, {
      event_type: "checkout_started",
      store_event: false,
      customer_id:
        customerIdFromCustomEvent ||
        init.data.customer?.id ||
        checkout?.order?.customer?.id ||
        null,
      customer_email: emailFromCustomEvent || checkoutEmail || shopifyEmail,
      session_id: event.clientId,
      page_url: event.context?.window?.location?.href,
      cart_id: cartId,
      checkout_id: checkout?.token || checkout?.id || null,
      metadata: {
        eventId: event.id,
        timestamp: event.timestamp,
      },
    });
  });
}

function sendEvent(apiUrl, payload) {
  if (!apiUrl) {
    return;
  }

  fetch(`${apiUrl}/api/analytics`, {
    method: "POST",
    body: JSON.stringify(payload),
    keepalive: true,
  });
}
async function resolveCartId({ event, browser, init }) {
  if (init.data.cart?.id) {
    return init.data.cart.id;
  }

  try {
    const cartCookie = await browser.cookie.get("cart");
    if (cartCookie) {
      return cartCookie;
    }
  } catch (error) {
    console.log("Cart cookie unavailable", error);
  }

  try {
    const origin = event.context?.window?.location?.origin;
    if (!origin) {
      return null;
    }

    const response = await fetch(`${origin}/cart.js`);
    const cart = await response.json();
    return cart.token || null;
  } catch (error) {
    console.log("Cart.js unavailable", error);
    return null;
  }
}

