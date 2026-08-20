import { json } from "@remix-run/node";
import { supabase } from "../lib/supabase.server";

export async function action({ request }) {
  if (request.method !== "POST") {
    return json(
      { error: "Method not allowed" },
      { status: 405 }
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
        { status: 400 }
      );
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
        { status: 500 }
      );
    }

    return json({
      success: true,
      event: data,
    });
  } catch (error) {
    console.error("Analytics API error:", error);

    return json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}