export function setupPageViewTracking(analytics) {
  analytics.subscribe("page_viewed", (event) => {
    console.log("Page viewed", event);
  });
}
