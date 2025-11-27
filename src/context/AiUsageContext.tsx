"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { showError } from "@/utils/toast";

interface AiUsageState {
  dailyLimit: number;
  requestsToday: number;
  lastReset: number; // Timestamp of the last reset
}

interface AiUsageContextType extends AiUsageState {
  recordRequest: () => boolean; // Checks if a request is allowed
  incrementRequest: () => void; // Increments the request count
  getRemaining: () => number;
  timeUntilReset: number; // Time in milliseconds until next reset
}

const AI_DAILY_LIMIT = 50; // You can adjust this limit
const LOCAL_STORAGE_KEY = "aiUsageTracker";

const AiUsageContext = createContext<AiUsageContextType | undefined>(undefined);

export const AiUsageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [usageState, setUsageState] = useState<AiUsageState>(() => {
    if (typeof window !== "undefined") {
      const storedState = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedState) {
        const parsedState: AiUsageState = JSON.parse(storedState);
        // Check for daily reset on load
        const now = Date.now();
        const lastResetDate = new Date(parsedState.lastReset);
        const today = new Date(now);
        
        // Reset if it's a new day since lastReset
        if (
          lastResetDate.getDate() !== today.getDate() ||
          lastResetDate.getMonth() !== today.getMonth() ||
          lastResetDate.getFullYear() !== today.getFullYear()
        ) {
          return {
            dailyLimit: AI_DAILY_LIMIT,
            requestsToday: 0,
            lastReset: now,
          };
        }
        return { ...parsedState, dailyLimit: AI_DAILY_LIMIT };
      }
    }
    return {
      dailyLimit: AI_DAILY_LIMIT,
      requestsToday: 0,
      lastReset: Date.now(),
    };
  });

  const [timeUntilReset, setTimeUntilReset] = useState(0);

  // Effect to update localStorage whenever usageState changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(usageState));
    }
  }, [usageState]);

  // Effect to manage the daily reset timer
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0); // Set to midnight of tomorrow

      const newTimeUntilReset = tomorrow.getTime() - now.getTime();
      setTimeUntilReset(newTimeUntilReset);

      // If time has passed midnight, trigger a reset
      if (newTimeUntilReset <= 0) {
        setUsageState(prev => ({
          ...prev,
          requestsToday: 0,
          lastReset: Date.now(),
        }));
      }
    };

    updateTimer(); // Initial call
    const intervalId = setInterval(updateTimer, 1000); // Update every second

    return () => clearInterval(intervalId);
  }, []); // Empty dependency array means this runs once on mount

  // Checks if a request is allowed without incrementing
  const recordRequest = useCallback(() => {
    if (usageState.requestsToday < usageState.dailyLimit) {
      return true;
    }
    showError("AI request limit exceeded for today. Please try again tomorrow!");
    return false;
  }, [usageState]);

  // Increments the request count (called after successful API call)
  const incrementRequest = useCallback(() => {
    setUsageState(prev => ({
      ...prev,
      requestsToday: prev.requestsToday + 1,
    }));
  }, []);

  const getRemaining = useCallback(() => {
    return usageState.dailyLimit - usageState.requestsToday;
  }, [usageState]);

  const contextValue = useMemo(() => ({
    ...usageState,
    recordRequest,
    incrementRequest, // Include new function
    getRemaining,
    timeUntilReset,
  }), [usageState, recordRequest, incrementRequest, getRemaining, timeUntilReset]);

  return (
    <AiUsageContext.Provider value={contextValue}>
      {children}
    </AiUsageContext.Provider>
  );
};

export const useAiUsage = () => {
  const context = useContext(AiUsageContext);
  if (context === undefined) {
    throw new Error("useAiUsage must be used within an AiUsageProvider");
  }
  return context;
};