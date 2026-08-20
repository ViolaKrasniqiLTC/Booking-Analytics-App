import { register } from "@shopify/web-pixels-extension";
import { registerAddToCart } from "./addToCart";
import { setupPageViewTracking } from "./pageView";

register((ctx) => {
  registerAddToCart(ctx);
  setupPageViewTracking(ctx.analytics, ctx.init, ctx.settings);
});
