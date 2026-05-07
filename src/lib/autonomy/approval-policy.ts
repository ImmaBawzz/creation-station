import type {
  ActionApprovalRequirement,
  ActionRiskLevel,
} from "@/lib/autonomy/action-registry";

export function approvalRequirementForRisk(riskLevel: ActionRiskLevel): ActionApprovalRequirement {
  if (riskLevel === "low") {
    return "auto";
  }

  if (riskLevel === "medium") {
    return "user_approval";
  }

  return "manual_override";
}

export function approvalPolicyLabel(requirement: ActionApprovalRequirement): string {
  if (requirement === "auto") {
    return "Auto approved";
  }

  if (requirement === "user_approval") {
    return "User approval required";
  }

  return "Blocked until manual override";
}
