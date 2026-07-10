export type { PositionState, ExitReason, Position, TradeRecord } from "./types.js";
export { computeCommission, computeSlippagePct, applySlippage } from "./costModel.js";
export {
  computeInitialStop,
  computeTp1,
  updateChandelierStop,
  isRegimeFlipped,
  isTimeStopHit,
} from "./exitRules.js";
export {
  simulateEntryFill,
  resolveOpenFullBarOutcome,
  resolveOpenRunnerBarOutcome,
  type FillOutcome,
} from "./fillSimulation.js";
export {
  evaluateSystemState,
  INITIAL_SYSTEM_STATE,
  type SystemState,
  type SystemStateInfo,
} from "./systemState.js";
export {
  ExecutionEngine,
  type ExecutionEngineDeps,
  type ExecutionEngineSnapshot,
  type QueueEntryParams,
  type QueueEntryResult,
} from "./ExecutionEngine.js";
