import { json } from "@remix-run/node";
import { useEffect, useState } from "react";
import { useLoaderData, useSearchParams } from "react-router";
import { supabase } from "../lib/supabase.server";
import { authenticate } from "../shopify.server";
import { ensureWebPixel } from "../lib/ensure-web-pixel.server";

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);
  await ensureWebPixel(admin);

  const url = new URL(request.url);
  const email = url.searchParams.get("email")?.trim() || "";

  let query = supabase
    .from("analytics_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (email) {
    query = query.ilike("customer_email", `%${email}%`);
  }

  const { data: events, error } = await query;

  if (error) {
    console.error("Supabase error:", error);

    throw new Response("Failed to load analytics", {
      status: 500,
    });
  }

  const pageViews = events.filter(
    (event) => event.event_type === "page_viewed"
  ).length;

  const addToCart = events.filter(
    (event) => event.event_type === "product_added_to_cart"
  ).length;

  const checkoutAbandoned = events.filter(
    (event) => event.event_type === "checkout_abandoned"
  ).length;

  return json({
    events,
    stats: {
      pageViews,
      addToCart,
      checkoutAbandoned,
    },
    email,
  });
}

export default function AnalyticsDashboard() {
  const { events, stats, email } = useLoaderData();
  const [, setSearchParams] = useSearchParams();
  const [searchEmail, setSearchEmail] = useState(email);

  useEffect(() => {
    setSearchEmail(email);
  }, [email]);

  function updateEmailParam(emailValue) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const trimmed = emailValue.trim();

      if (trimmed) {
        next.set("email", trimmed);
      } else {
        next.delete("email");
      }

      return next;
    });
  }

  function handleSearch(event) {
    event.preventDefault();
    updateEmailParam(searchEmail);
  }

  function clearFilter() {
    setSearchEmail("");
    updateEmailParam("");
  }

  return (
    <s-page heading="Analytics">
      <s-section>
        <s-stack direction="block" gap="base">

          <s-text>
            Customer activity from your Shopify store.
          </s-text>

          <form onSubmit={handleSearch}>
            <s-stack direction="inline" gap="base">

              <s-text-field
                name="email"
                label="Customer email"
                value={searchEmail}
                onInput={(event) => setSearchEmail(event.currentTarget.value)}
                placeholder="customer@example.com"
              />

              <s-button type="submit">
                Search
              </s-button>

              {email && (
                <s-button
                  type="button"
                  variant="secondary"
                  onClick={clearFilter}
                >
                  Clear
                </s-button>
              )}

            </s-stack>
          </form>

        </s-stack>
      </s-section>

      <s-section heading="Overview">

        <s-grid
          gridTemplateColumns="repeat(3, 1fr)"
          gap="base"
        >

          <s-clickable>
            <s-box padding="large" border="base" borderRadius="base">
              <s-stack direction="block" gap="small">
                <s-text>Page Views</s-text>
                <s-heading>{stats.pageViews}</s-heading>
              </s-stack>
            </s-box>
          </s-clickable>

          <s-box padding="large" border="base" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text>Add to Cart</s-text>
              <s-heading>{stats.addToCart}</s-heading>
            </s-stack>
          </s-box>

          <s-box padding="large" border="base" borderRadius="base">
            <s-stack direction="block" gap="small">
              <s-text>Checkout Abandoned</s-text>
              <s-heading>{stats.checkoutAbandoned}</s-heading>
            </s-stack>
          </s-box>

        </s-grid>

      </s-section>

      <s-section heading="Recent activity">

        {events.length === 0 ? (
          <s-banner tone="info">
            No analytics events found.
          </s-banner>
        ) : (
          <s-table variant="auto">
            <s-table-header-row>

              <s-table-header listSlot="primary">
                Event
              </s-table-header>

              <s-table-header>
                Customer
              </s-table-header>

              <s-table-header>
                Page / Product
              </s-table-header>

              <s-table-header>
                Date
              </s-table-header>

            </s-table-header-row>

            <s-table-body>
              {events.map((event, index) => (
                <s-table-row key={event.id ?? `${event.created_at}-${index}`}>

                  <s-table-cell>
                    {formatEventName(event.event_type)}
                  </s-table-cell>

                  <s-table-cell>
                    {event.customer_email || "Anonymous"}
                  </s-table-cell>

                  <s-table-cell>
                    {event.page_url ||
                      event.product_title ||
                      "—"}
                  </s-table-cell>

                  <s-table-cell>
                    {formatDate(event.created_at)}
                  </s-table-cell>

                </s-table-row>
              ))}
            </s-table-body>

          </s-table>
        )}

      </s-section>
    </s-page>
  );
}

function formatEventName(eventType) {
  const names = {
    page_viewed: "Page viewed",
    product_added_to_cart: "Added to cart",
    checkout_started: "Checkout started",
    checkout_abandoned: "Checkout abandoned",
  };

  return names[eventType] || eventType;
}

function formatDate(date) {
  if (!date) {
    return "—";
  }

  return new Date(date).toLocaleString();
}