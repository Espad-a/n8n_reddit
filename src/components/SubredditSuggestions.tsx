"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { showError } from "@/utils/toast";
import { RefreshCw, ArrowLeft } from "lucide-react"; // Added ArrowLeft icon
import { cn } from "@/lib/utils";

interface SubredditSuggestionsProps {
  onSelectSubreddit: (subredditName: string) => void;
}

const INITIAL_LOAD_COUNT = 15; // Number of suggestions to display

// Fisher-Yates shuffle algorithm
const shuffleArray = (array: string[]) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const SubredditSuggestions: React.FC<SubredditSuggestionsProps> = ({ onSelectSubreddit }) => {
  const [suggestionsHistory, setSuggestionsHistory] = useState<string[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1); // -1 means no history yet
  const [isLoading, setIsLoading] = useState(true);

  // Derive current subreddits from history
  const currentSubreddits = historyIndex >= 0 ? suggestionsHistory[historyIndex] : [];

  const fetchAndStoreSuggestions = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("subreddits")
        .select("name");

      if (error) {
        throw new Error(error.message);
      }

      const allNames = data ? data.map(s => s.name) : [];
      const shuffledNames = shuffleArray([...allNames]);
      const newSuggestions = shuffledNames.slice(0, INITIAL_LOAD_COUNT);

      setSuggestionsHistory(prevHistory => {
        // If we're not at the end of history, truncate "future" history
        const newHistory = prevHistory.slice(0, historyIndex + 1);
        return [...newHistory, newSuggestions];
      });
      setHistoryIndex(prevIndex => prevIndex + 1);

    } catch (error) {
      console.error("Error fetching subreddits:", error);
      showError(`Failed to load subreddits: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  }, [historyIndex]);

  useEffect(() => {
    if (historyIndex === -1) { // Only fetch on initial mount if no history exists
      fetchAndStoreSuggestions();
    }
  }, [historyIndex, fetchAndStoreSuggestions]);

  const handleReloadSuggestions = useCallback(() => {
    fetchAndStoreSuggestions();
  }, [fetchAndStoreSuggestions]);

  const handleGoBack = useCallback(() => {
    setHistoryIndex(prevIndex => Math.max(0, prevIndex - 1));
  }, []);

  const canGoBack = historyIndex > 0;

  return (
    <Card className="w-full max-w-3xl mb-8 shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">Suggested Subreddits</CardTitle>
        <CardDescription className="text-center mt-2">
          Click a subreddit badge to add it to an active input field.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && currentSubreddits.length === 0 ? (
          <div className="flex flex-wrap gap-2 justify-center">
            {Array.from({ length: INITIAL_LOAD_COUNT }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-24 rounded-full" />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 justify-center">
            {currentSubreddits.map((name) => (
              <Badge
                key={name}
                variant="secondary"
                className="cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors duration-200 text-blue-700 dark:text-blue-300"
                onClick={() => onSelectSubreddit(name)}
              >
                r/{name}
              </Badge>
            ))}
          </div>
        )}
        <div className="flex justify-center mt-6 space-x-4">
          <Button
            onClick={handleGoBack}
            disabled={!canGoBack || isLoading}
            variant="outline"
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
          <Button
            onClick={handleReloadSuggestions}
            disabled={isLoading}
            variant="outline"
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 dark:border-gray-100"></span>
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Reload Suggestions
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SubredditSuggestions;