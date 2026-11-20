import {CheckCircle2,XCircle,GitCompareArrows,CircleHelp,type LucideIcon} from "lucide-react";
import type {Verdict} from "@claimlens/shared";
export const labels:Record<Verdict,{label:string;icon:LucideIcon;detail:string}>={
  TRUE:{label:"Supported",icon:CheckCircle2,detail:"The retrieved evidence supports this claim."},
  FALSE:{label:"Refuted",icon:XCircle,detail:"The retrieved evidence contradicts this claim."},
  MIXED:{label:"Mixed findings",icon:GitCompareArrows,detail:"The evidence is conflicting or not every component was established."},
  UNVERIFIED:{label:"Unverified",icon:CircleHelp,detail:"The available evidence does not establish this claim."},
};
