// @ts-nocheck
/* re-exports for UI layer (avoids circular imports) */
import { S } from "./store";
export {
  fmtTime, pointsFor, potArrows, specLabel, getWR, getNR, getCR,
  estimateRelay, findAth, legendScore, predictTime, impliedPerf,
} from "./model";

export function rankOfPlayerUI(evk: string): number {
  const list = S.world?.rankings?.[evk] || [];
  const i = list.findIndex((r: any) => r.id === S.player?.id);
  return i < 0 ? 0 : i + 1;
}
