import { setupWorker } from "msw/browser";
import { handlers } from "./handlers.js";

export function setupMocks() {
  const worker = setupWorker(...handlers);
  return worker.start({ onUnhandledRequest: "bypass" });
}
