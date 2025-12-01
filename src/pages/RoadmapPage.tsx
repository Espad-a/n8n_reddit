"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { showLoading, showSuccess, showError, dismissToast } from "@/utils/toast";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { ArrowLeft, CheckCircle, XCircle, DollarSign, Clock, Zap, Lightbulb, Wrench, BookOpen, ExternalLink, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAiUsage } from "@/context/AiUsageContext";
import LoadingGame from "@/components/LoadingGame"; // Import LoadingGame
import { supabase } from "@/lib/supabase"; // Import supabase

interface Post {
  id: string;
  subreddit: string;
  title: string;
  selftext: string;
  url: string;
  aiSummary?: string;
  isLiked?: boolean;
}

// New interfaces for the structured roadmap data
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

// Define props for the RoadmapPage component
interface RoadmapPageProps {
  likedPosts: Post[];
  selectedPostId: string | null;
  setSelectedPostId: React.Dispatch<React.SetStateAction<string | null>>;
  roadmapMarkdown: string | null; // This will be replaced by roadmapData
  setRoadmapMarkdown: React.Dispatch<React.SetStateAction<string | null>>; // This will be replaced by setRoadmapData
  isLoadingRoadmap: boolean;
  setIsLoadingRoadmap: React.Dispatch<React.SetStateAction<boolean>>;
}

const RoadmapPage: React.FC<RoadmapPageProps> = ({
  likedPosts,
  selectedPostId,
  setSelectedPostId,
  roadmapMarkdown: _roadmapMarkdown, // Renamed to avoid conflict, will not be used
  setRoadmapMarkdown: _setRoadmapMarkdown, // Renamed to avoid conflict, will not be used
  isLoadingRoadmap,
  setIsLoadingRoadmap,
}) => {
  const navigate = useNavigate();
  const { recordRequest, incrementRequest } = useAiUsage();
  const [roadmapData, setRoadmapData] = useState<RoadmapData | null>(null); // New state for structured data
  const [isSavingRoadmap, setIsSavingRoadmap] = useState(false); // New state for saving roadmap

  useEffect(() => {
    if (likedPosts.length === 0) {
      showError("No liked posts found to generate a roadmap. Please like some posts first.");
      navigate("/");
    }
  }, [likedPosts, navigate]);

  const handleProceed = useCallback(async () => {
    if (!selectedPostId) {
      showError("Please select a post to get a roadmap.");
      return;
    }

    if (!recordRequest()) {
      return;
    }

    const post = likedPosts.find(p => p.id === selectedPostId);
    if (!post) {
      showError("Selected post not found.");
      return;
    }

    setIsLoadingRoadmap(true);
    const toastId = showLoading(`Generating roadmap for "${post.title}"...`);

    try {
      const response = await fetch(import.meta.env.VITE_REDDIT_ROADMAP_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          postId: post.id,
          postTitle: post.title,
          postSelftext: post.selftext,
          postSubreddit: post.subreddit,
          postAiSummary: post.aiSummary,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Webhook failed with status ${response.status}: ${errorData}`);
      }

      incrementRequest();

      const rawRoadmapData = await response.json();
      if (!rawRoadmapData || rawRoadmapData.length === 0 || !rawRoadmapData[0].data) {
        throw new Error("Unexpected roadmap data structure from webhook.");
      }
      
      setRoadmapData(rawRoadmapData[0].data); // Set the structured data
      showSuccess("Roadmap generated successfully!");

    } catch (error) {
      console.error("Error fetching roadmap:", error);
      setRoadmapData(null);
      showError(`Failed to get roadmap: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      dismissToast(toastId);
      setIsLoadingRoadmap(false);
    }
  }, [selectedPostId, likedPosts, setIsLoadingRoadmap, incrementRequest, recordRequest]);

  const handleSaveRoadmap = useCallback(async () => {
    if (!roadmapData || !selectedPostId) {
      showError("No roadmap to save or no post selected.");
      return;
    }

    setIsSavingRoadmap(true);
    const toastId = showLoading("Saving roadmap...");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showError("You must be logged in to save roadmaps.");
        setIsSavingRoadmap(false);
        dismissToast(toastId);
        return;
      }

      // Find the saved_posts entry for the selectedPostId (Reddit ID)
      const { data: savedPostData, error: savedPostError } = await supabase
        .from('saved_posts')
        .select('id')
        .eq('post_id', selectedPostId)
        .single();

      if (savedPostError || !savedPostData) {
        throw new Error(`Could not find saved post for ID ${selectedPostId}. Please save the post first.`);
      }

      const { error } = await supabase
        .from('saved_roadmaps')
        .upsert({
          user_id: user.id,
          saved_post_id: savedPostData.id, // Link to the UUID of the saved_post
          roadmap_data: roadmapData,
        }, { onConflict: 'saved_post_id' }); // Upsert based on saved_post_id

      if (error) {
        throw new Error(error.message);
      }

      showSuccess("Roadmap saved successfully!");
      navigate("/saved-roadmaps"); // Navigate to the new saved roadmaps page

    } catch (error) {
      console.error("Error saving roadmap:", error);
      showError(`Failed to save roadmap: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      dismissToast(toastId);
      setIsSavingRoadmap(false);
    }
  }, [roadmapData, selectedPostId, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-4">
      <div className="w-full max-w-3xl flex justify-start mb-6">
        <Button variant="ghost" onClick={() => navigate("/")} className="flex items-center">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Posts
        </Button>
      </div>

      <Card className="w-full max-w-3xl mb-8 shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">Generate Project Roadmap</CardTitle>
          <CardDescription className="text-center mt-2">
            Select one of your liked posts to generate a detailed project roadmap.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Select onValueChange={setSelectedPostId} value={selectedPostId || ""}>
              <SelectTrigger className="w-full sm:w-[400px]">
                <SelectValue placeholder="Select a liked post" />
              </SelectTrigger>
              <SelectContent>
                {likedPosts.map((post) => (
                  <SelectItem key={post.id} value={post.id}>
                    {post.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleProceed} disabled={!selectedPostId || isLoadingRoadmap} className="w-full sm:w-auto">
              {isLoadingRoadmap ? "Generating..." : "Proceed"}
            </Button>
          </div>

          {isLoadingRoadmap && (
            <LoadingGame />
          )}

          {roadmapData && (
            <div className="mt-8 p-8 bg-white rounded-2xl shadow-sm border border-gray-200 
                           dark:bg-gray-800 dark:border-gray-700 max-w-none 
                           animate-in fade-in slide-in-from-bottom-8 duration-700">
              <h2 className="text-3xl font-bold text-center mb-6 text-primary dark:text-foreground">
                {roadmapData.goal}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <Card className="p-4 flex flex-col items-center text-center">
                  <Clock className="h-8 w-8 text-blue-500 mb-2" />
                  <h4 className="font-semibold text-lg">Startup Time</h4>
                  <p className="text-muted-foreground">{roadmapData.startup_time}</p>
                </Card>
                <Card className="p-4 flex flex-col items-center text-center">
                  <DollarSign className="h-8 w-8 text-green-500 mb-2" />
                  <h4 className="font-semibold text-lg">Money Required</h4>
                  <p className="text-muted-foreground">{roadmapData.money_required.level}</p>
                  <p className="text-xs text-muted-foreground">{roadmapData.money_required.description}</p>
                </Card>
                <Card className="p-4 flex flex-col items-center text-center">
                  <Zap className="h-8 w-8 text-yellow-500 mb-2" />
                  <h4 className="font-semibold text-lg">Difficulty</h4>
                  <p className="text-muted-foreground">{roadmapData.difficulty.level}</p>
                  <p className="text-xs text-muted-foreground">{roadmapData.difficulty.explanation}</p>
                </Card>
              </div>

              <section className="mb-8">
                <h3 className="text-2xl font-bold mb-4 text-primary dark:text-foreground flex items-center gap-2">
                  <Lightbulb className="h-6 w-6 text-accent-brand" /> Roadmap Steps
                </h3>
                <ol className="space-y-6 relative before:absolute before:left-3 before:top-0 before:h-full before:w-0.5 before:bg-gray-200 dark:before:bg-gray-700">
                  {roadmapData.roadmap.map((step, index) => (
                    <li key={index} className="relative pl-10">
                      <div className="absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full bg-accent-brand text-white dark:bg-accent-brand-foreground dark:text-accent-brand font-bold text-sm">
                        {step.step}
                      </div>
                      <Card className="ml-4 p-4">
                        <CardTitle className="text-xl font-semibold mb-2">{step.title}</CardTitle>
                        <CardDescription className="mb-2">{step.what_to_do}</CardDescription>
                        <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                          Why it matters: {step.why_it_matters}
                        </p>
                      </Card>
                    </li>
                  ))}
                </ol>
              </section>

              <section className="mb-8">
                <h3 className="text-2xl font-bold mb-4 text-primary dark:text-foreground flex items-center gap-2">
                  <CheckCircle className="h-6 w-6 text-green-500" /> Advantages
                </h3>
                <div className="flex flex-wrap gap-2">
                  {roadmapData.advantages.map((advantage, index) => (
                    <Badge key={index} variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      {advantage}
                    </Badge>
                  ))}
                </div>
              </section>

              <section className="mb-8">
                <h3 className="text-2xl font-bold mb-4 text-primary dark:text-foreground flex items-center gap-2">
                  <XCircle className="h-6 w-6 text-red-500" /> Disadvantages
                </h3>
                <div className="flex flex-wrap gap-2">
                  {roadmapData.disadvantages.map((disadvantage, index) => (
                    <Badge key={index} variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                      {disadvantage}
                    </Badge>
                  ))}
                </div>
              </section>

              <section className="mb-8">
                <h3 className="text-2xl font-bold mb-4 text-primary dark:text-foreground flex items-center gap-2">
                  <Wrench className="h-6 w-6 text-purple-500" /> Required Tools
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Essential:</h4>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      {roadmapData.required_tools.essential.map((tool, index) => (
                        <li key={index}>{tool}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Optional:</h4>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      {roadmapData.required_tools.optional.map((tool, index) => (
                        <li key={index}>{tool}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Accounts:</h4>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      {roadmapData.required_tools.accounts.map((account, index) => (
                        <li key={index}>{account}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-2xl font-bold mb-4 text-primary dark:text-foreground flex items-center gap-2">
                  <BookOpen className="h-6 w-6 text-orange-500" /> Recommended Resources
                </h3>
                <div className="space-y-4">
                  {roadmapData.recommended_resources.map((resource, index) => (
                    <Card key={index} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                      <div>
                        <CardTitle className="text-lg font-semibold">{resource.name}</CardTitle>
                        <CardDescription className="text-sm text-muted-foreground">
                          {resource.type} • Cost: {resource.cost}
                        </CardDescription>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{resource.description}</p>
                      </div>
                      <Button asChild variant="outline" className="mt-3 sm:mt-0 flex-shrink-0">
                        <a href={resource.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                          Visit <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </Card>
                  ))}
                </div>
              </section>
              <div className="flex justify-center mt-8">
                <Button
                  onClick={handleSaveRoadmap}
                  disabled={isSavingRoadmap}
                  className="w-full sm:w-auto px-8 py-2 text-lg"
                >
                  {isSavingRoadmap ? (
                    <>
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                      Saving Roadmap...
                    </>
                  ) : (
                    <>
                      <Save className="h-5 w-5 mr-2" />
                      Save Roadmap
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <MadeWithDyad />
        </CardFooter>
      </Card>
    </div>
  );
};

export default RoadmapPage;