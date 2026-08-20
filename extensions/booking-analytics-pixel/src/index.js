import { register } from "@shopify/web-pixels-extension";
import { registerAddToCart } from "./addToCart";

register(registerAddToCart);