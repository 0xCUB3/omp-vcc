import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { scaffoldSettings } from "./src/core/settings";
import { registerBeforeCompactHook } from "./src/hooks/before-compact";
import { registerProactiveThresholdHook } from "./src/hooks/proactive-threshold";
import { registerOmpVccCommand } from "./src/commands/omp-vcc";
import { registerVccRecallCommand } from "./src/commands/vcc-recall";
import { registerRecallTool } from "./src/tools/recall";
import { resetInvisibleContinue } from "./src/core/invisible-continue";

export default (pi: ExtensionAPI) => {
  scaffoldSettings();
  registerBeforeCompactHook(pi);
  registerProactiveThresholdHook(pi);
  registerOmpVccCommand(pi);
  registerVccRecallCommand(pi);
  registerRecallTool(pi);

  pi.on("session_start", () => {
    resetInvisibleContinue();
  });
};
