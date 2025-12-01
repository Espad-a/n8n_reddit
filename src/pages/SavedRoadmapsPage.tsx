"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { showLoading, showSuccess, showError, dismissToast } from "@/utils/toast";
import { ArrowLeft, Trash2, DollarSign, Clock, Zap, Lightbulb, Wrench, BookOpen, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { MadeWithDyad } from "@/components/made-with-dyad";

// Re-using interfaces from RoadmapPage.tsx
interface MoneyRequired {
  level: string;
  cost_range: string;
  description: string;
}

interface Difficulty {
  level: string;
  explanation: string;
}

interface RoadmapStep {
  step: number;
  title: string;
  what_to_do: string;
  why_it_matters: string;
}

interface RequiredTools {
  essential: string[];
  optional: string[];
  accounts: string[];
}

interface RecommendedResource {
  name: string;
  type: string;
  url: string;
  cost: string;
  description: string;
}

interface RoadmapData {
  goal: string;
  startup_time: string;
  money_required: MoneyRequired;
  difficulty: Difficulty;
  roadmap: RoadmapStep[];
  advantages: string[];
  disadvantages: string[];
  required_tools: RequiredTools;
  recommended_resources: RecommendedResource[];
}

interface SavedRoadmap {
  id: string; // UUID from Supabase
  user_id: string;
  saved_post_id: string; // UUID of the saved_post
  roadmap_data: RoadmapData;
  created_at: string;
  // Optionally, include post details if needed for display
  saved_posts: {
    title: string;
    subreddit: string;
    post_id: string; // Original Reddit post ID
  } | null;
}

const SavedRoadmapsPage: React.FC = () => {
  const navigate = useNavigate();
  const [savedRoadmaps, setSavedRoadmaps] = useState<SavedRoadmap[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null); // Track which roadmap is being deleted

  const fetchSavedRoadmaps = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showError("You must be logged in to view saved roadmaps.");
        navigate("/"); // Redirect to home if not logged in
        return;
      }

      const { data, error } = await supabase
        .from('saved_roadmaps')
        .select(`
          *,
          saved_posts (
            title,
            subreddit,
            post_id
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      setSavedRoadmaps(data || []);
      showSuccess("Saved roadmaps loaded!");
    } catch (error) {
      console.error("Error fetching saved roadmaps:", error);
      showError(`Failed to load saved roadmaps: ${error instanceof Error ? error.message : String(error)}`);
      setSavedRoadmaps([]);
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchSavedRoadmaps();
  }, [fetchSavedRoadmaps]);

  const handleDeleteRoadmap = useCallback(async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete the roadmap for "${title}"?`)) {
      return;
    }

    setIsDeleting(id);
    const toastId = showLoading("Deleting roadmap...");

    try {
      const { error } = await supabase
        .from('saved_roadmaps')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(error.message);
      }

      setSavedRoadmaps(prev => prev.filter(roadmap => roadmap.id !== id));
      showSuccess("Roadmap deleted successfully!");
    } catch (error) {
      console.error("Error deleting roadmap:", error);
      showError(`Failed to delete roadmap: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      dismissToast(toastId);
      setIsDeleting(null);
    }
  }, []);

  return (
    <div className="container mx-auto py-8 px-4 flex flex-col items-center min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="w-full max-w-4xl flex justify-start mb-6">
        <Button variant="ghost" onClick={() => navigate("/")} className="flex items-center">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
        </Button>
      </div>

      <Card className="w-full max-w-4xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">Your Saved Roadmaps</CardTitle>
          <CardDescription className="text-center mt-2">
            Review your saved project roadmaps.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <Card key={i} className="w-full shadow-md">
                <CardHeader>
                  <Skeleton className="h-8 w-3/4 mb-2" />
                  <Skeleton className="h-5 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full mb-4" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))
          ) : savedRoadmaps.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center text-lg">
              You haven't saved any roadmaps yet. Generate one from a liked post!
            </p>
          ) : (
            savedRoadmaps.map((savedRoadmap) => (
              <Card key={savedRoadmap.id} className="w-full shadow-md relative p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <CardTitle className="text-2xl font-bold text-primary dark:text-foreground">
                      {savedRoadmap.roadmap_data.goal}
                    </CardTitle>
                    {savedRoadmap.saved_posts && (
                      <CardDescription className="text-sm text-muted-foreground mt-1">
                        Based on post: "{savedRoadmap.saved_posts.title}" (r/{savedRoadmap.saved_posts.subreddit})
                      </CardDescription>
                    )}
                    <CardDescription className="text-sm text-muted-foreground mt-1">
                      Saved on: {new Date(savedRoadmap.created_at).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => handleDeleteRoadmap(savedRoadmap.id, savedRoadmap.roadmap_data.goal)}
                    disabled={isDeleting === savedRoadmap.id}
                    className="ml-4 flex-shrink-0"
                    aria-label="Delete roadmap"
                  >
                    {isDeleting === savedRoadmap.id ? (
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                    ) : (
                      <Trash2 className="h-5 w-5" />
                    )}
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  <Card className="p-4 flex flex-col items-center text-center">
                    <Clock className="h-8 w-8 text-blue-500 mb-2" />
                    <h4 className="font-semibold text-lg">Startup Time</h4>
                    <p className="text-muted-foreground">{savedRoadmap.roadmap_data.startup_time}</p>
                  </Card>
                  <Card className="p-4 flex flex-col items-center text-center">
                    <DollarSign className="h-8 w-8 text-green-500 mb-2" />
                    <h4 className="font-semibold text-lg">Money Required</h4>
                    <p className="text-muted-foreground">{savedRoadmap.roadmap_data.money_required.level}</p>
                    <p className="text-xs text-muted-foreground">{savedRoadmap.roadmap_data.money_required.description}</p>
                  </Card>
                  <Card className="p-4 flex flex-col items-center text-center">
                    <Zap className="h-8 w-8 text-yellow-500 mb-2" />
                    <h4 className="font-semibold text-lg">Difficulty</h4>
                    <p className="text-muted-foreground">{savedRoadmap.roadmap_data.difficulty.level}</p>
                    <p className="text-xs text-muted-foreground">{savedRoadmap.roadmap_data.difficulty.explanation}</p>
                  </Card>
                </div>

                <section className="mb-8">
                  <h3 className="text-xl font-bold mb-4 text-primary dark:text-foreground flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-accent-brand" /> Roadmap Steps
                  </h3>
                  <ol className="space-y-4 relative before:absolute before:left-3 before:top-0 before:h-full before:w-0.5 before:bg-gray-200 dark:before:bg-gray-700">
                    {savedRoadmap.roadmap_data.roadmap.map((step, index) => (
                      <li key={index} className="relative pl-10">
                        <div className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-accent-brand text-white dark:bg-accent-brand-foreground dark:text-accent-brand font-bold text-xs">
                          {step.step}
                        </div>
                        <Card className="ml-4 p-3">
                          <CardTitle className="text-lg font-semibold mb-1">{step.title}</CardTitle>
                          <CardDescription className="text-sm mb-1">{step.what_to_do}</CardDescription>
                          <p className="text-xs text-gray-600 dark:text-gray-400 italic">
                            Why it matters: {step.why_it_matters}
                          </p>
                        </Card>
                      </li>
                    ))}
                  </ol>
                </section>

                <section className="mb-8">
                  <h3 className="text-xl font-bold mb-4 text-primary dark:text-foreground flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-purple-500" /> Required Tools
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <h4 className="font-semibold mb-1">Essential:</h4>
                      <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                        {savedRoadmap.roadmap_data.required_tools.essential.map((tool, index) => (
                          <li key={index}>{tool}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Optional:</h4>
                      <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                        {savedRoadmap.roadmap_data.required_tools.optional.map((tool, index) => (
                          <li key={index}>{tool}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Accounts:</h4>
                      <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                        {savedRoadmap.roadmap_data.required_tools.accounts.map((account, index) => (
                          <li key={index}>{account}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-xl font-bold mb-4 text-primary dark:text-foreground flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-orange-500" /> Recommended Resources
                  </h3>
                  <div className="space-y-3">
                    {savedRoadmap.roadmap_data.recommended_resources.map((resource, index) => (
                      <Card key={index} className="p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                        <div>
                          <CardTitle className="text-base font-semibold">{resource.name}</CardTitle>
                          <CardDescription className="text-xs text-muted-foreground">
                            {resource.type} • Cost: {resource.cost}
                          </CardDescription>
                          <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">{resource.description}</p>
                        </div>
                        <Button asChild variant="outline" size="sm" className="mt-2 sm:mt-0 flex-shrink-0">
                          <a href={resource.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                            Visit <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      </Card>
                    ))}
                  </div>
                </section>
              </Card>
            ))
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <MadeWithDyad />
        </CardFooter>
      </Card>
    </div>
  );
};

export default SavedRoadmapsPage;