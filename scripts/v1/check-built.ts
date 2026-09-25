import { checkHistory } from "./compatibility-history";
import { checkCompatibility } from "./compatibility-check";
import {
  verifyCopies,
  verifyCurrentRuntime,
  verifyReleasedIdentities,
  runtimeDestinations,
} from "./runtime-artifacts";
await checkHistory();
const runtimes = await verifyCopies(runtimeDestinations);
verifyCurrentRuntime(runtimes);
await verifyReleasedIdentities(runtimes);
await checkCompatibility();
