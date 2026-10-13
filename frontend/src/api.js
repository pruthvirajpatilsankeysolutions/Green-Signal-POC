// One entry point for all API calls. Each category lives in its own file in src/api/,
// matching the backend's api/routes/. Pages keep using: import { api } from "../api.js"
import { clientsApi } from "./api/clients.js";
import { draftsApi } from "./api/drafts.js";
import { eventsApi } from "./api/events.js";
import { festivalsApi } from "./api/festivals.js";
import { reactionsApi } from "./api/reactions.js";
import { statusApi } from "./api/status.js";
import { designsApi } from "./api/designs.js";
export { getClientId, setClientId } from "./api/request.js";

export const api = {
  ...statusApi,
  ...clientsApi,
  ...festivalsApi,
  ...eventsApi,
  ...reactionsApi,
  ...draftsApi,
  ...designsApi,
};