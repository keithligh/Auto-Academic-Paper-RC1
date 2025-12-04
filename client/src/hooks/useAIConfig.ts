import { useContext } from "react";
import { AIConfigContext } from "@/context/AIConfigContext";

export function useAIConfig() {
    const context = useContext(AIConfigContext);
    return context;
}
