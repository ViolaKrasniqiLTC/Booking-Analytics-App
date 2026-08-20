import { json } from "@remix-run/node";
import { useEffect, useState } from "react";
import { useLoaderData, useSearchParams } from "react-router";
import { supabase } from "../lib/supabase.server";
import { authenticate } from "../shopify.server";
import { syncWebPixel } from "../lib/web-pixel.server";

const PAGE_SIZE = 10;

function applyEmailFilter(query, email) {
  if (email) {
    return query.ilike("customer_email", `%${email}%`);
  }

  return query;
}

async function countEvents(email, eventType) {
  let query = supabase
    .from("analytics_events")
    .select("*", { count: "exact", head: true });

  query = applyEmailFilter(query, email);

  if (eventType) {
    query = query.eq("event_type", eventType);
  }

  const { count, error } = await query;

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function loader({ request }) {
  const { admin, session } = await authenticate.admin(request);
  await syncWebPixel(admin, session.shop);

  const url = new URL(request.url);
  const email = url.searchParams.get("email")?.trim() || "";
  const requestedPage = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
  const requestedPageNumber =
    Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  let countQuery = supabase
    .from("analytics_events")
    .select("*", { count: "exact", head: true });

  countQuery = applyEmailFilter(countQuery, email);

  const { count: totalCount, error: countError } = await countQuery;

  if (countError) {
    console.error("Supabase error:", countError);

    throw new Response("Failed to load analytics", {
      status: 500,
    });
  }

  const totalPages = Math.max(1, Math.ceil((totalCount ?? 0) / PAGE_SIZE));
  const page = Math.min(requestedPageNumber, totalPages);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let eventsQuery = supabase
    .from("analytics_events")
    .select("*")
    .order("created_at", { ascending: false })
    .range(from, to);

  eventsQuery = applyEmailFilter(eventsQuery, email);

  const [{ data: events, error }, pageViews, addToCart, checkoutAbandoned] =
    await Promise.all([
      eventsQuery,
      countEvents(email, "page_viewed"),
      countEvents(email, "product_added_to_cart"),
      countEvents(email, "checkout_abandoned"),
    ]);

  if (error) {
    console.error("Supabase error:", error);

    throw new Response("Failed to load analytics", {
      status: 500,
    });
  }

  return json({
    events: events ?? [],
    stats: {
      pageViews,
      addToCart,
      checkoutAbandoned,
    },
    email,
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      totalCount: totalCount ?? 0,
      totalPages,
    },
  });
}

export default function AnalyticsDashboard() {
  const { events, stats, email, pagination } = useLoaderData();
  const [, setSearchParams] = useSearchParams();
  const [searchEmail, setSearchEmail] = useState(email);

  useEffect(() => {
    setSearchEmail(email);
  }, [email]);

  function updateSearchParams(updater) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      updater(next);
      return next;
    });
  }

  function updateEmailParam(emailValue) {
    updateSearchParams((next) => {
      const trimmed = emailValue.trim();

      if (trimmed) {
        next.set("email", trimmed);
      } else {
        next.delete("email");
      }

      next.delete("page");
    });
  }

  function goToPage(nextPage) {
    updateSearchParams((next) => {
      if (nextPage <= 1) {
        next.delete("page");
      } else {
        next.set("page", String(nextPage));
      }
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
          <s-stack direction="block" gap="base">
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

            {pagination.totalPages > 1 && (
              <s-stack direction="inline" gap="base">
                <s-button
                  type="button"
                  variant="secondary"
                  disabled={pagination.page <= 1}
                  onClick={() => goToPage(pagination.page - 1)}
                >
                  Previous
                </s-button>

                <s-text>
                  Page {pagination.page} of {pagination.totalPages}
                </s-text>

                <s-button
                  type="button"
                  variant="secondary"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => goToPage(pagination.page + 1)}
                >
                  Next
                </s-button>
              </s-stack>
            )}
          </s-stack>
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