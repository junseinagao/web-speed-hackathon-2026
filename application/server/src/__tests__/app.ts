import { createHonoTestApp } from "./helpers";

const { app: honoApp } = await import("@web-speed-hackathon-2026/server/src/app");

export const app = createHonoTestApp(honoApp);
