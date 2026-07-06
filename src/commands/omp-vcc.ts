import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { getLastCompactionStats, OMP_VCC_COMPACT_INSTRUCTION } from "../hooks/before-compact";
import { countOmpVccCompactionsFromSession, ordinalSuffix } from "../core/compaction-count";

const formatTokens = (n: number): string => {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
};

export const registerOmpVccCommand = (pi: ExtensionAPI) => {
  pi.registerCommand("omp-vcc", {
    description: "Compact conversation with omp-vcc structured summary",
    handler: async (_args, ctx) => {
      ctx.compact({
        customInstructions: OMP_VCC_COMPACT_INSTRUCTION,
        onComplete: () => {
          const stats = getLastCompactionStats();
          const count = countOmpVccCompactionsFromSession(ctx.sessionManager);
          const compactionLabel = count > 0
            ? ` (${count}${ordinalSuffix(count)} compaction)`
            : "";
          if (stats) {
            ctx.ui.notify(
              `omp-vcc: ${stats.summarized} source entries processed; tail kept ${stats.kept} (~${formatTokens(stats.keptTokensEst)} tok).${compactionLabel}`,
              "info",
            );
          } else {
            ctx.ui.notify(`Compacted with omp-vcc${compactionLabel}`, "info");
          }
        },
        onError: (err) => {
          if (err.message === "Compaction cancelled" || err.message === "Already compacted") {
            ctx.ui.notify("Nothing to compact", "warning");
          } else {
            ctx.ui.notify(`Compaction failed: ${err.message}`, "error");
          }
        },
      });
    },
  });
};
