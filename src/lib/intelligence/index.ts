export { buildIntelligenceRecommendations } from "@/lib/intelligence/recommender";
export { buildTaskMomentumContext, planContextKey } from "@/lib/intelligence/planner";
export { detectIdeaRoute } from "@/lib/intelligence/router";
export { recommendNextTasks } from "@/lib/intelligence/prioritizer";
export {
  getTaskStaleness,
  getTaskWaitingState,
  taskBlockerReferenceIds,
} from "@/lib/intelligence/validator";

export type { IntelligenceRecommendation } from "@/lib/intelligence/recommender";
export type {
  IntelligencePlan,
  IntelligenceTask,
  TaskMomentumContext,
} from "@/lib/intelligence/planner";
export type { IdeaRoute, IntelligenceIdea } from "@/lib/intelligence/router";
export type {
  TaskStaleness,
  TaskWaitingState,
} from "@/lib/intelligence/validator";
