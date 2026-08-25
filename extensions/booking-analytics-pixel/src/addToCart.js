import { CUSTOM_EVENTS } from "./events";

export function registerAddToCart({
  analytics,
  browser,
  init,
  settings,
}) {
  const apiUrl = settings?.apiUrl;

  if (!apiUrl) {
    console.error("Pixel apiUrl setting is missing");
    return;
  }

  console.log("🟢 ADD TO CART TRACKING INITIALIZED");

  analytics.subscribe("product_added_to_cart", async (event) => {
    console.log("🔥 NATIVE PRODUCT ADDED TO CART", event);

    try {
      const cartLine = event.data?.cartLine;

      const customerEmail =
        init?.data?.customer?.email || null;

      const customerId =
        init?.data?.customer?.id || null;

      const cartId = await resolveCartId({
        event,
        browser,
        init,
      });

      const payload = {
        event_type: "product_added_to_cart",

        customer_id: customerId,

        customer_email: customerEmail,

        session_id: event.clientId || null,

        page_url:
          event.context?.window?.location?.href || null,

        product_id:
          cartLine?.merchandise?.product?.id || null,

        product_title:
          cartLine?.merchandise?.product?.title || null,

        quantity:
          cartLine?.quantity || null,

        cart_id: cartId,

        checkout_id: null,

        metadata: {
          event_id: event.id || null,
          timestamp:
            event.timestamp || new Date().toISOString(),
          source: "shopify_product_added_to_cart",
        },
      };

      console.log("📤 SENDING ADD TO CART", payload);

      await sendEvent(apiUrl, payload);
    } catch (error) {
      console.error("❌ ADD TO CART ERROR", error);
    }
  });
}

async function sendEvent(apiUrl, payload) {
  try {
    const response = await fetch(
      `${apiUrl}/api/analytics`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        keepalive: true,
      }
    );

    const result = await response.json();

    console.log("📥 API RESPONSE", result);

    if (!response.ok) {
      console.error("❌ ANALYTICS ERROR", result);
      return;
    }

    console.log("✅ PRODUCT ADDED TO CART SENT");
  } catch (error) {
    console.error("❌ FETCH ERROR", error);
  }
}

async function resolveCartId({
  event,
  browser,
  init,
}) {
  if (init?.data?.cart?.id) {
    return init.data.cart.id;
  }

  try {
    const cartCookie =
      await browser.cookie.get("cart");

    if (cartCookie) {
      return cartCookie;
    }
  } catch (error) {
    console.log("Cart cookie unavailable", error);
  }

  try {
    const origin =
      event.context?.window?.location?.origin;

    if (!origin) {
      return null;
    }

    const response = await fetch(
      `${origin}/cart.js`
    );

    if (!response.ok) {
      return null;
    }

    const cart = await response.json();

    return cart?.token || null;
  } catch (error) {
    console.log("Cart.js unavailable", error);
    return null;
  }
}