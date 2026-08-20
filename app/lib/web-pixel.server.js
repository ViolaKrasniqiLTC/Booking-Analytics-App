const WEB_PIXEL_QUERY = `#graphql
  query WebPixelSettings {
    webPixel {
      id
      settings
    }
  }
`;

const WEB_PIXEL_CREATE = `#graphql
  mutation WebPixelCreate($settings: JSON!) {
    webPixelCreate(webPixel: { settings: $settings }) {
      userErrors {
        code
        field
        message
      }
      webPixel {
        id
        settings
      }
    }
  }
`;

const WEB_PIXEL_UPDATE = `#graphql
  mutation WebPixelUpdate($id: ID!, $settings: JSON!) {
    webPixelUpdate(id: $id, webPixel: { settings: $settings }) {
      userErrors {
        code
        field
        message
      }
      webPixel {
        id
        settings
      }
    }
  }
`;

function getAppUrl() {
  const url = process.env.SHOPIFY_APP_URL?.replace(/\/$/, "");

  if (!url) {
    console.warn("[web-pixel] SHOPIFY_APP_URL is not set; skipping pixel sync");
    return null;
  }

  return url;
}

function buildSettings(shop, appUrl) {
  const accountID = shop.replace(".myshopify.com", "");

  return {
    accountID,
    apiUrl: appUrl,
  };
}

function parseSettings(settings) {
  if (!settings) {
    return {};
  }

  try {
    return typeof settings === "string" ? JSON.parse(settings) : settings;
  } catch {
    return {};
  }
}

function logUserErrors(action, errors) {
  if (errors.length === 0) {
    return false;
  }

  console.error(`[web-pixel] ${action} failed:`, errors);
  return true;
}

async function updateWebPixel(admin, id, settings) {
  const response = await admin.graphql(WEB_PIXEL_UPDATE, {
    variables: { id, settings },
  });
  const { data } = await response.json();
  const result = data?.webPixelUpdate;

  if (logUserErrors("update", result?.userErrors ?? [])) {
    return false;
  }

  console.log("[web-pixel] updated apiUrl to", settings.apiUrl);
  return true;
}

async function createWebPixel(admin, settings) {
  const response = await admin.graphql(WEB_PIXEL_CREATE, {
    variables: { settings },
  });
  const { data } = await response.json();
  const result = data?.webPixelCreate;
  const errors = result?.userErrors ?? [];

  if (errors.some((error) => error.code === "TAKEN")) {
    return "taken";
  }

  if (logUserErrors("create", errors)) {
    return false;
  }

  console.log("[web-pixel] created with apiUrl", settings.apiUrl);
  return true;
}

export async function syncWebPixel(admin, shop) {
  const appUrl = getAppUrl();

  if (!appUrl) {
    return;
  }

  const settings = buildSettings(shop, appUrl);

  const queryResponse = await admin.graphql(WEB_PIXEL_QUERY);
  const { data } = await queryResponse.json();
  const existing = data?.webPixel;

  if (existing) {
    const current = parseSettings(existing.settings);

    if (current.apiUrl === appUrl && current.accountID === settings.accountID) {
      return;
    }

    await updateWebPixel(admin, existing.id, settings);
    return;
  }

  const createResult = await createWebPixel(admin, settings);

  if (createResult !== "taken") {
    return;
  }

  const retryResponse = await admin.graphql(WEB_PIXEL_QUERY);
  const retryData = await retryResponse.json();
  const pixel = retryData.data?.webPixel;

  if (pixel) {
    await updateWebPixel(admin, pixel.id, settings);
  }
}
