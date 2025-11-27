"use client";

import React from "react";
import { useAiUsage } from "@/context/AiUsageContext";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

const AICountdown: React.FC = () => {
  const { dailyLimit, requestsToday, timeUntilReset } = useAiUsage();
  const remaining = dailyLimit - requestsToday;

  const hours = Math.floor(timeUntilReset / (1000 * 60 * 60));
  const minutes = Math.floor((timeUntilReset % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeUntilReset % (1000 * 60)) / 1000);

  const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const isLowRemaining = remaining <= 10 && remaining > 0;
  const isNoRemaining = remaining <= 0;

  return (
    <div className={cn(
      "ai-countdown flex items-center space-x-2 text-sm font-medium px-3 py-1.5 rounded-md transition-colors duration-200",
      "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
      isLowRemaining && "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
      isNoRemaining && "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
    )}>
      <Sparkles className="h-4 w-4" />
      <span className="countdown-header">AI Requests:</span>
      <div className="countdown-display">
        <span className={cn(
          "remaining font-bold",
          isLowRemaining && "text-yellow-800 dark:text-yellow-300",
          isNoRemaining && "text-red-800 dark:text-red-300"
        )}>
          {remaining}
        </span>
        <span className="total"> / {dailyLimit}</span>
      </div>
      <div className="countdown-reset text-xs text-gray-500 dark:text-gray-400">
        (Resets in: {formattedTime})
      </div>
    </div>
  );
};

export default AICountdown;