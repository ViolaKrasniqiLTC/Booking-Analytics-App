import { json } from "@remix-run/node";
import { supabase } from "../lib/supabase.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Handles browser preflight (OPTIONS) before POST
export async function loader({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return json(
    { error: "Method not allowed" },
    { status: 405, headers: corsHeaders }
  );
}

export async function action({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json(
      { error: "Method not allowed" },
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    const event = await request.json();

    const {
      event_type,
      customer_id,
      customer_email,
      session_id,
      page_url,
      product_id,
      product_title,
      quantity,
      cart_id,
      checkout_id,
      metadata,
    } = event;

    if (!event_type) {
      return json(
        { error: "event_type is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const shouldStoreEvent =
      event.store_event !== false &&
      (event_type === "product_added_to_cart" || event_type === "page_viewed");

    if (session_id && (cart_id || checkout_id || customer_email)) {
      const patch = {};
      if (cart_id) patch.cart_id = cart_id;
      if (checkout_id) patch.checkout_id = checkout_id;
      if (customer_email) patch.customer_email = customer_email;

      const { error: backfillError } = await supabase
        .from("analytics_events")
        .update(patch)
        .eq("session_id", session_id)
        .eq("event_type", "product_added_to_cart");

      if (backfillError) {
        console.error("Supabase backfill error:", backfillError);
      }
    }

    if (!shouldStoreEvent) {
      return json({ success: true }, { headers: corsHeaders });
    }

    const { data, error } = await supabase
      .from("analytics_events")
      .insert({
        event_type,
        customer_id,
        customer_email,
        session_id,
        page_url,
        product_id,
        product_title,
        quantity,
        cart_id,
        checkout_id,
        metadata,
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);

      return json(
        { error: "Failed to store analytics event" },
        { status: 500, headers: corsHeaders }
      );
    }

    return json(
      { success: true, event: data },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Analytics API error:", error);

    return json(
      { error: "Invalid request" },
      { status: 400, headers: corsHeaders }
    );
  }
}
