import { register } from "@shopify/web-pixels-extension";

import { registerAddToCart } from "./addToCart";
import { setupPageViewTracking } from "./pageView";
import { registerCheckoutTracking } from "./checkoutTracking";

register((ctx) => {
  console.log("🔥 PIXEL LOADED");
  console.log("analytics object:", ctx.analytics);

  registerAddToCart(ctx);

  setupPageViewTracking(
    ctx.analytics,
    ctx.init,
    ctx.settings
  );

  registerCheckoutTracking(ctx);

  console.log("🔥 ALL TRACKING REGISTERED");
});