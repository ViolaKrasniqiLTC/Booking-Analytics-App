import { register } from "@shopify/web-pixels-extension";

register(({ analytics }) => {
  analytics.subscribe("checkout_started", (event) => {
    console.log("CHECKOUT STARTED");
    console.log(event);
  });
});