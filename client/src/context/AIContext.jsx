import { createContext, useCallback, useContext, useState } from "react";
import { aiApi } from "../api/ai.api.js";

export const AIContext = createContext(null);

export function AIProvider({ children }) {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadPlan = useCallback(async (courseId) => {
    setLoading(true);
    setError("");
    try {
      const result = await aiApi.getPlan(courseId);
      setPlan(result);
      return result;
    } catch (requestError) {
      setError(requestError.message || "Unable to load the study plan.");
      throw requestError;
    } finally {
      setLoading(false);
    }
  }, []);

  const recordWatchEvent = useCallback(async (event) => {
    try {
      return await aiApi.recordWatchEvent(event);
    } catch (requestError) {
      setError(requestError.message || "Unable to save watch progress.");
      throw requestError;
    }
  }, []);

  return (
    <AIContext.Provider
      value={{
        plan,
        loading,
        error,
        loadPlan,
        recordWatchEvent,
        askTutor: aiApi.askTutor,
      }}
    >
      {children}
    </AIContext.Provider>
  );
}

export function useAI() {
  const context = useContext(AIContext);
  if (!context) throw new Error("useAI must be used within AIProvider.");
  return context;
}
