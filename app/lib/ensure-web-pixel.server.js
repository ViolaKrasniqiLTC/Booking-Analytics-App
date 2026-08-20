const WEB_PIXEL_QUERY = `#graphql
  query WebPixel {
    webPixel {
      id
      settings
    }
  }
`;

const WEB_PIXEL_CREATE = `#graphql
  mutation webPixelCreate($webPixel: WebPixelInput!) {
    webPixelCreate(webPixel: $webPixel) {
      userErrors {
        field
        message
        code
      }
      webPixel {
        id
        settings
      }
    }
  }
`;

const WEB_PIXEL_UPDATE = `#graphql
  mutation webPixelUpdate($id: ID!, $webPixel: WebPixelInput!) {
    webPixelUpdate(id: $id, webPixel: $webPixel) {
      userErrors {
        field
        message
        code
      }
      webPixel {
        id
        settings
      }
    }
  }
`;

export async function ensureWebPixel(admin) {
  const apiUrl = (process.env.SHOPIFY_APP_URL || "").replace(/\/$/, "");

  if (!apiUrl) {
    console.error("SHOPIFY_APP_URL is missing; cannot configure web pixel");
    return;
  }

  const settings = {
    accountID: "booking-analytics",
    apiUrl,
  };

  const existingResponse = await admin.graphql(WEB_PIXEL_QUERY);
  const existingJson = await existingResponse.json();
  const existing = existingJson.data?.webPixel;
  const currentSettings = parseSettings(existing?.settings);

  if (!existing?.id) {
    const createResponse = await admin.graphql(WEB_PIXEL_CREATE, {
      variables: { webPixel: { settings } },
    });
    const createJson = await createResponse.json();
    const errors = createJson.data?.webPixelCreate?.userErrors;

    if (errors?.length) {
      console.error("webPixelCreate errors:", errors);
    }

    return;
  }

  if (
    currentSettings.apiUrl === settings.apiUrl &&
    currentSettings.accountID === settings.accountID
  ) {
    return;
  }

  const updateResponse = await admin.graphql(WEB_PIXEL_UPDATE, {
    variables: {
      id: existing.id,
      webPixel: { settings },
    },
  });
  const updateJson = await updateResponse.json();
  const errors = updateJson.data?.webPixelUpdate?.userErrors;

  if (errors?.length) {
    console.error("webPixelUpdate errors:", errors);
  }
}

function parseSettings(settings) {
  if (!settings) {
    return {};
  }

  if (typeof settings === "string") {
    try {
      return JSON.parse(settings);
    } catch (error) {
      console.error("Failed to parse web pixel settings:", error);
      return {};
    }
  }

  return settings;
}
