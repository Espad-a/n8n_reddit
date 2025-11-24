"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { showLoading, showSuccess, showError, dismissToast } from "@/utils/toast";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { ArrowLeft } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Post {
  id: string;
  subreddit: string;
  title: string;
  selftext: string;
  url: string;
  aiSummary?: string;
  isLiked?: boolean;
}

// Define props for the RoadmapPage component
interface RoadmapPageProps {
  likedPosts: Post[]; // Now received via props
  selectedPostId: string | null; // New prop
  setSelectedPostId: React.Dispatch<React.SetStateAction<string | null>>; // New prop
  roadmapMarkdown: string | null; // New prop
  setRoadmapMarkdown: React.Dispatch<React.SetStateAction<string | null>>; // New prop
  isLoadingRoadmap: boolean; // New prop
  setIsLoadingRoadmap: React.Dispatch<React.SetStateAction<boolean>>; // New prop
}

const RoadmapPage: React.FC<RoadmapPageProps> = ({
  likedPosts,
  selectedPostId,
  setSelectedPostId,
  roadmapMarkdown,
  setRoadmapMarkdown,
  isLoadingRoadmap,
  setIsLoadingRoadmap,
}) => {
  // useLocation is no longer needed for likedPosts
  const navigate = useNavigate();

  useEffect(() => {
    if (likedPosts.length === 0) {
      showError("No liked posts found to generate a roadmap. Please like some posts first.");
      navigate("/"); // Redirect to home if no liked posts
    }
  }, [likedPosts, navigate]);

  const handleProceed = useCallback(async () => {
    if (!selectedPostId) {
      showError("Please select a post to get a roadmap.");
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

      const rawRoadmapData = await response.json();
      if (!rawRoadmapData || rawRoadmapData.length === 0 || !rawRoadmapData[0].text) {
        throw new Error("Unexpected roadmap data structure from webhook.");
      }
      
      setRoadmapMarkdown(rawRoadmapData[0].text); // Set the markdown string
      showSuccess("Roadmap generated successfully!");

    } catch (error) {
      console.error("Error fetching roadmap:", error);
      showError(`Failed to get roadmap: ${error instanceof Error ? error.message : String(error)}`);
      setRoadmapMarkdown(null);
    } finally {
      dismissToast(toastId);
      setIsLoadingRoadmap(false);
    }
  }, [selectedPostId, likedPosts, setIsLoadingRoadmap, setRoadmapMarkdown]);

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

          {roadmapMarkdown && (
            <div className="mt-8 p-8 bg-white rounded-2xl shadow-sm border border-gray-200 
                           dark:bg-gray-800 dark:border-gray-700 prose dark:prose-invert 
                           max-w-none animate-in fade-in slide-in-from-bottom-8 duration-700">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {roadmapMarkdown}
              </ReactMarkdown>
            </div>
          )}
        </CardContent>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default RoadmapPage;