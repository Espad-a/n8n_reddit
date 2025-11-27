"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Target } from "lucide-react"; // A nice icon for the target

const GAME_AREA_WIDTH = 300;
const GAME_AREA_HEIGHT = 200;
const TARGET_SIZE = 40; // Diameter of the circle
const TARGET_LIFETIME_MS = 1500; // 1.5 seconds to click
const COMBO_WINDOW_MS = 1000; // 1 second between clicks for combo

const LoadingGame: React.FC = () => {
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [targetPosition, setTargetPosition] = useState({ x: 0, y: 0 });
  const [targetKey, setTargetKey] = useState(0); // Forces re-render for animation
  const [targetVisible, setTargetVisible] = useState(false);
  const [lastClickTime, setLastClickTime] = useState(0);
  const targetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const generateRandomPosition = useCallback(() => {
    const newX = Math.random() * (GAME_AREA_WIDTH - TARGET_SIZE);
    const newY = Math.random() * (GAME_AREA_HEIGHT - TARGET_SIZE);
    return { x: newX, y: newY };
  }, []);

  const spawnNewTarget = useCallback(() => {
    setTargetVisible(false); // Hide briefly for a "blink" effect
    setTimeout(() => {
      setTargetPosition(generateRandomPosition());
      setTargetKey(prev => prev + 1);
      setTargetVisible(true);
      // Clear any existing timer
      if (targetTimerRef.current) {
        clearTimeout(targetTimerRef.current);
      }
      // Set a new timer for target disappearance
      targetTimerRef.current = setTimeout(() => {
        setTargetVisible(false);
        setCombo(0); // Reset combo if target expires
        spawnNewTarget(); // Spawn a new one automatically
      }, TARGET_LIFETIME_MS);
    }, 100); // Short delay for blink effect
  }, [generateRandomPosition]);

  useEffect(() => {
    spawnNewTarget(); // Start the first target
    return () => {
      if (targetTimerRef.current) {
        clearTimeout(targetTimerRef.current);
      }
    };
  }, [spawnNewTarget]);

  const handleClickTarget = useCallback(() => {
    const currentTime = Date.now();
    if (targetTimerRef.current) {
      clearTimeout(targetTimerRef.current); // Target clicked, clear its disappearance timer
    }

    setScore(prevScore => prevScore + 1 + combo); // Add combo bonus
    setTargetVisible(false); // Hide target immediately on click

    if (currentTime - lastClickTime < COMBO_WINDOW_MS) {
      setCombo(prevCombo => prevCombo + 1);
    } else {
      setCombo(0); // Reset combo if too slow
    }
    setLastClickTime(currentTime);

    spawnNewTarget(); // Spawn a new target
  }, [combo, lastClickTime, spawnNewTarget]);

  return (
    <div className="w-full max-w-md p-4 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-800 dark:to-gray-900 rounded-lg shadow-inner border border-blue-200 dark:border-gray-700 flex flex-col items-center justify-center relative overflow-hidden">
      <h3 className="text-xl font-bold text-blue-800 dark:text-blue-200 mb-2">Quick Click Challenge!</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Click the target as fast as you can while waiting for posts.</p>
      
      <div
        className="relative bg-white dark:bg-gray-700 rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden"
        style={{ width: GAME_AREA_WIDTH, height: GAME_AREA_HEIGHT }}
      >
        {targetVisible && (
          <Button
            key={targetKey}
            className={cn(
              "absolute w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg",
              "bg-gradient-to-br from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 active:scale-90 transition-all duration-100 ease-out",
              "animate-in fade-in zoom-in-90" // Animation for new target appearing
            )}
            style={{ left: targetPosition.x, top: targetPosition.y }}
            onClick={handleClickTarget}
            aria-label="Click the target"
          >
            <Target className="h-5 w-5" />
          </Button>
        )}
      </div>
      <div className="mt-4 flex justify-between w-full max-w-[300px] text-lg font-semibold text-gray-800 dark:text-gray-200">
        <span>Score: {score}</span>
        {combo > 0 && (
          <span className="text-green-600 dark:text-green-400 animate-in fade-in slide-in-from-bottom-2 duration-300">
            Combo: x{combo}
          </span>
        )}
      </div>
    </div>
  );
};

export default LoadingGame;