import { json } from "@remix-run/node";
import { supabase } from "../lib/supabase.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function loader({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  return json(
    { error: "Method not allowed" },
    {
      status: 405,
      headers: corsHeaders,
    }
  );
}

export async function action({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return json(
      { error: "Method not allowed" },
      {
        status: 405,
        headers: corsHeaders,
      }
    );
  }

  try {
    const event = await request.json();

    console.log("=================================");
    console.log("📥 ANALYTICS REQUEST RECEIVED");
    console.log("=================================");
    console.log(JSON.stringify(event, null, 2));

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
        {
          success: false,
          error: "event_type is required",
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    /*
     * SAVE EVERY EVENT
     *
     * Don't filter checkout_started here.
     */

    const row = {
      event_type: event_type,
      customer_id: customer_id || null,
      customer_email: customer_email || null,
      session_id: session_id || null,
      page_url: page_url || null,
      product_id: product_id || null,
      product_title: product_title || null,
      quantity: quantity || null,
      cart_id: cart_id || null,
      checkout_id: checkout_id || null,
      metadata: metadata || {},
    };

    console.log("📤 INSERTING INTO SUPABASE:");
    console.log(JSON.stringify(row, null, 2));

    const { data, error } = await supabase
      .from("analytics_events")
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error("=================================");
      console.error("❌ SUPABASE INSERT FAILED");
      console.error("=================================");
      console.error(error);

      return json(
        {
          success: false,
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        },
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    console.log("=================================");
    console.log("✅ SAVED TO SUPABASE");
    console.log("=================================");
    console.log(data);

    return json(
      {
        success: true,
        stored: true,
        data,
      },
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    console.error("=================================");
    console.error("❌ API ERROR");
    console.error("=================================");
    console.error(error);

    return json(
      {
        success: false,
        error: error?.message || "Invalid request",
      },
      {
        status: 400,
        headers: corsHeaders,
      }
    );
  }
}