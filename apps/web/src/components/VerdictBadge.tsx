import type {Verdict} from "@claimlens/shared";
import {labels} from "../verdicts";
export default function VerdictBadge({verdict}:{verdict:Verdict}){const {label,icon:Icon}=labels[verdict];return <span className={`verdict-badge verdict-${verdict.toLowerCase()}`}><Icon size={15}/>{label}</span>;}
