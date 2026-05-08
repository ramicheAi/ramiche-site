import { createFlagsDiscoveryEndpoint } from "flags/next";
import { getProviderData } from "@flags-sdk/vercel";
import * as flags from "../../../apex-athlete/flags";

export const GET = process.env.FLAGS
  ? createFlagsDiscoveryEndpoint(async () => {
      return getProviderData(flags);
    })
  : () => new Response("Flags not configured", { status: 503 });
