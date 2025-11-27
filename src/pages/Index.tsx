"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Button } from "@/components/ui/button";
import { showLoading, showSuccess, showError, dismissToast } from "@/utils/toast";
import PostCard from "@/components/PostCard";
import { v4 as uuidv4 } from 'uuid';
import { downloadHtmlFile } from "@/lib/download";
import { useNavigate } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import LoadingGame from "@/components/LoadingGame";
import { useAiUsage } from "@/context/AiUsageContext";
import { supabase } from "@/lib/supabase"; // Import supabase client
import SubredditSuggestions from "@/components/SubredditSuggestions"; // Import the new component
import { Lightbulb, Save } from "lucide-react"; // Import Lightbulb and Save icon

interface Post {
  id: string;
  subreddit: string;
  title: string;
  selftext: string;
  url: string;
  aiSummary?: string;
  isLiked?: boolean;
}

interface Comment {
  depth: number;
  author: string;
  body: string;
  score: number;
  created: string;
  id: string;
  permalink: string;
  isTopLevel: boolean;
}

interface IndividualThread {
  summary: {
    totalComments: number;
    uniqueAuthors: number;
    topLevelComments: number;
  };
  comments: Comment[];
  displayText: string;
}

interface CombinedSummary {
  totalThreads: number;
  totalComments: number;
  totalUniqueAuthors: number;
  totalTopLevelComments: number;
}

interface CommentsResponse {
  combinedSummary: CombinedSummary;
  individualThreads: IndividualThread[];
  displayText: string;
  commentSummaries?: Record<string, string | null>; // Added to store AI summaries for comments
}

interface IndexProps {
  allPosts: Post[];
  setAllPosts: React.Dispatch<React.SetStateAction<Post[]>>;
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  handleLikeToggle: (postId: string) => void;
  selectedSubreddit: string;
  setSelectedSubreddit: React.Dispatch<React.SetStateAction<string>>;
  allFetchedComments: Record<string, CommentsResponse | null>;
  onFetchComments: (postId: string, subreddit: string) => Promise<CommentsResponse | null>;
  updateCommentSummaryInCache: (postId: string, commentId: string, summary: string | null) => void; // New prop
}

const Index: React.FC<IndexProps> = ({
  allPosts,
  setAllPosts,
  isLoading,
  setIsLoading,
  handleLikeToggle,
  selectedSubreddit,
  setSelectedSubreddit,
  allFetchedComments,
  onFetchComments,
  updateCommentSummaryInCache,
}) => {
  const navigate = useNavigate();
  const { recordRequest, incrementRequest } = useAiUsage();

  const [subreddit1, setSubreddit1] = useState<string>("");
  const [subreddit2, setSubreddit2] = useState<string>("");
  const [postType1, setPostType1] = useState<string>("hot");
  const [postType2, setPostType2] = useState<string>("hot");
  const [numPosts1, setNumPosts1] = useState<string>("10");
  const [numPosts2, setNumPosts2] = useState<string>("10");
  const [activeSubredditInput, setActiveSubredditInput] = useState<"1" | "2" | null>(null); // State to track which input is active
  const [isSavingPosts, setIsSavingPosts] = useState(false); // New state for saving posts

  // Removed the useEffect for fetching subreddits here, it's now handled by SubredditSuggestions

  const uniqueSubreddits = useMemo(() => {
    const subreddits = new Set(allPosts.map(post => post.subreddit));
    return ["all", ...Array.from(subreddits).sort()];
  }, [allPosts]);

  const filteredPosts = useMemo(() => {
    if (selectedSubreddit === "all") {
      return allPosts;
    }
    return allPosts.filter(post => post.subreddit === selectedSubreddit);
  }, [allPosts, selectedSubreddit]);

  const likedPosts = useMemo(() => {
    return allPosts.filter(post => post.isLiked);
  }, [allPosts]);

  const handleDownloadLikedPosts = useCallback(() => {
    if (likedPosts.length === 0) {
      showError("No posts liked to download!");
      return;
    }
    downloadHtmlFile(likedPosts, allFetchedComments, "liked_reddit_posts.html");
    showSuccess(`Downloaded ${likedPosts.length} liked posts as HTML.`);
  }, [likedPosts, allFetchedComments]);

  const handleGetRoadmap = useCallback(() => {
    if (likedPosts.length === 0) {
      showError("Please like at least one post to get a roadmap.");
      return;
    }
    navigate("/roadmap");
  }, [likedPosts, navigate]);

  const handleSaveLikedPosts = useCallback(async () => {
    if (likedPosts.length === 0) {
      showError("No posts liked to save!");
      return;
    }

    setIsSavingPosts(true);
    const toastId = showLoading(`Saving ${likedPosts.length} liked posts...`);

    try {
      // Removed user authentication check as per request
      const postsToSave = likedPosts.map(post => ({
        post_id: post.id,
        subreddit: post.subreddit,
        title: post.title,
        selftext: post.selftext,
        url: post.url,
        ai_summary: post.aiSummary,
        comments_data: allFetchedComments[post.id] || null, // Include comments if fetched
      }));

      const { error } = await supabase
        .from('saved_posts')
        .upsert(postsToSave, { onConflict: 'post_id' }); // Upsert to update if already exists

      if (error) {
        throw new Error(error.message);
      }

      showSuccess(`Successfully saved ${likedPosts.length} posts!`);
      navigate("/saved-posts"); // Navigate to the new saved posts page

    } catch (error) {
      console.error("Error saving liked posts:", error);
      showError(`Failed to save posts: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      dismissToast(toastId);
      setIsSavingPosts(false);
    }
  }, [likedPosts, allFetchedComments, navigate]);

  const isFormValid =
    subreddit1.trim() !== "" &&
    subreddit2.trim() !== "" &&
    postType1 !== "" &&
    postType2 !== "" &&
    numPosts1 !== "" &&
    numPosts2 !== "";

  const triggerWebhook = useCallback(async () => {
    if (!recordRequest()) {
      return;
    }

    setIsLoading(true);
    const toastId = showLoading("Fetching posts...");

    try {
      const response = await fetch(import.meta.env.VITE_REDDIT_POSTS_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subreddit1: subreddit1.trim(),
          subreddit2: subreddit2.trim(),
          postType1: postType1,
          postType2: postType2,
          numPosts1: parseInt(numPosts1),
          numPosts2: parseInt(numPosts2),
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Webhook failed with status ${response.status}: ${errorData}`);
      }

      incrementRequest();

      const rawData = await response.json();
      const finalOutput = rawData[0];

      if (!finalOutput || !finalOutput.allLinkedPosts) {
        throw new Error("Unexpected data structure from webhook: missing allLinkedPosts.");
      }

      const combinedPosts: Post[] = finalOutput.allLinkedPosts.map((post: any) => {
        return {
          id: post.id,
          subreddit: post.subreddit,
          title: post.title,
          selftext: post.selftext,
          url: post.url,
          aiSummary: post.summary || "No AI summary available.",
          isLiked: false,
        };
      });

      setAllPosts(combinedPosts);
      showSuccess(`Webhook successful! Found ${combinedPosts.length} posts.`);

    } catch (error) {
      console.error("Error triggering webhook:", error);
      showError(`Failed to fetch posts: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      dismissToast(toastId);
      setIsLoading(false);
    }
  }, [setAllPosts, setIsLoading, subreddit1, subreddit2, postType1, postType2, numPosts1, numPosts2, recordRequest, incrementRequest]);

  const handleSelectSuggestedSubreddit = useCallback((name: string) => {
    if (activeSubredditInput === "1") {
      setSubreddit1(name);
      showSuccess(`Selected r/${name} for Subreddit 1.`);
    } else if (activeSubredditInput === "2") {
      setSubreddit2(name);
      showSuccess(`Selected r/${name} for Subreddit 2.`);
    } else {
      // Default to subreddit1 if no input is active
      setSubreddit1(name);
      showSuccess(`Selected r/${name} for Subreddit 1. Click the lightbulb icon next to Subreddit 2 to select for it.`);
    }
  }, [activeSubredditInput, setSubreddit1, setSubreddit2]);

  return (
    <div className="container mx-auto py-8 px-4 flex flex-col items-center min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Card className="w-full max-w-3xl mb-8 shadow-lg animate-in fade-in slide-in-from-top-8 duration-700">
        <CardHeader className="text-center">
          <CardTitle className="text-4xl font-extrabold tracking-tight lg:text-5xl">
            Opportunity Explorer
          </CardTitle>
          <CardDescription className="mt-2 text-lg text-gray-600 dark:text-gray-400">
            Uncover and refine your next big project idea from community discussions.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-xl">
            <div className="space-y-2">
              <Label htmlFor="subreddit1">Subreddit 1</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="subreddit1"
                  value={subreddit1}
                  onChange={(e) => setSubreddit1(e.target.value)}
                  placeholder="e.g., programming, startups"
                />
                <Button
                  variant={activeSubredditInput === "1" ? "default" : "outline"}
                  size="icon"
                  onClick={() => setActiveSubredditInput(prev => prev === "1" ? null : "1")}
                  title="Click to select suggested subreddits for this input"
                >
                  <Lightbulb className={cn("h-4 w-4", activeSubredditInput === "1" ? "text-white" : "text-gray-500")} />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subreddit2">Subreddit 2</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="subreddit2"
                  value={subreddit2}
                  onChange={(e) => setSubreddit2(e.target.value)}
                  placeholder="e.g., webdev, entrepreneur"
                />
                <Button
                  variant={activeSubredditInput === "2" ? "default" : "outline"}
                  size="icon"
                  onClick={() => setActiveSubredditInput(prev => prev === "2" ? null : "2")}
                  title="Click to select suggested subreddits for this input"
                >
                  <Lightbulb className={cn("h-4 w-4", activeSubredditInput === "2" ? "text-white" : "text-gray-500")} />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="postType1">Post Type for {subreddit1.trim() !== "" ? subreddit1 : "Subreddit 1"}</Label>
              <Select onValueChange={setPostType1} defaultValue={postType1}>
                <SelectTrigger id="postType1">
                  <SelectValue placeholder="Select post type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hot">Hot Posts</SelectItem>
                  <SelectItem value="top">Top Posts</SelectItem>
                  <SelectItem value="new">New Posts</SelectItem>
                  <SelectItem value="rising">Rising Posts</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="postType2">Post Type for {subreddit2.trim() !== "" ? subreddit2 : "Subreddit 2"}</Label>
              <Select onValueChange={setPostType2} defaultValue={postType2}>
                <SelectTrigger id="postType2">
                  <SelectValue placeholder="Select post type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hot">Hot Posts</SelectItem>
                  <SelectItem value="top">Top Posts</SelectItem>
                  <SelectItem value="new">New Posts</SelectItem>
                  <SelectItem value="rising">Rising Posts</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="numPosts1">Posts from {subreddit1.trim() !== "" ? subreddit1 : "Subreddit 1"} (Max 10)</Label>
              <Select onValueChange={setNumPosts1} defaultValue={numPosts1}>
                <SelectTrigger id="numPosts1">
                  <SelectValue placeholder="Number of posts" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 10 }, (_, i) => (i + 1).toString()).map((num) => (
                    <SelectItem key={num} value={num}>{num}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="numPosts2">Posts from {subreddit2.trim() !== "" ? subreddit2 : "Subreddit 2"} (Max 10)</Label>
              <Select onValueChange={setNumPosts2} defaultValue={numPosts2}>
                <SelectTrigger id="numPosts2">
                  <SelectValue placeholder="Number of posts" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 10 }, (_, i) => (i + 1).toString()).map((num) => (
                    <SelectItem key={num} value={num}>{num}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xl">
            <Button
              onClick={triggerWebhook}
              disabled={isLoading || !isFormValid}
              className={cn(
                "flex-1 px-8 py-4 text-lg font-semibold transition-all duration-300",
                (isLoading || !isFormValid) ? "bg-gray-400 dark:bg-gray-600 cursor-not-allowed" : "hover:scale-105 active:scale-95"
              )}
            >
              {isLoading ? "Fetching Posts..." : "Fetch Reddit Posts"}
            </Button>
          </div>
          {isLoading && (
            <LoadingGame />
          )}
        </CardContent>
      </Card>

      {/* Subreddit Suggestions Component */}
      <SubredditSuggestions onSelectSubreddit={handleSelectSuggestedSubreddit} />

      {allPosts.length > 0 && (
        <div className="w-full max-w-3xl flex flex-col sm:flex-row justify-between items-center mb-6 space-y-4 sm:space-y-0 sm:space-x-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
          <Select onValueChange={setSelectedSubreddit} defaultValue={selectedSubreddit}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filter by Subreddit" />
            </SelectTrigger>
            <SelectContent>
              {uniqueSubreddits.map(subreddit => (
                <SelectItem key={subreddit} value={subreddit}>
                  {subreddit === "all" ? "All Subreddits" : `r/${subreddit}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-4 w-full sm:w-auto">
            <Button
              onClick={handleDownloadLikedPosts}
              disabled={likedPosts.length === 0}
              variant="outline"
              className="w-full sm:w-auto transition-all duration-200 hover:scale-105"
            >
              Download Liked ({likedPosts.length})
            </Button>
            <Button
              onClick={handleSaveLikedPosts}
              disabled={likedPosts.length === 0 || isSavingPosts}
              className="w-full sm:w-auto transition-all duration-200 hover:scale-105"
            >
              {isSavingPosts ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Liked ({likedPosts.length})
                </>
              )}
            </Button>
            <Button
              onClick={handleGetRoadmap}
              disabled={likedPosts.length === 0}
              className="w-full sm:w-auto transition-all duration-200 hover:scale-105"
            >
              Get Roadmap
            </Button>
          </div>
        </div>
      )}

      <div className="w-full max-w-3xl flex flex-col items-center">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="w-full mb-6 shadow-md animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
              <CardHeader>
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full mb-4" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))
        ) : filteredPosts.length > 0 ? (
          <>
            <h2 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-200 animate-in fade-in slide-in-from-top-4 duration-700">
              {selectedSubreddit === "all" ? "All Fetched Posts" : `Posts from r/${selectedSubreddit}`}
            </h2>
            {filteredPosts.map((post, index) => (
              <PostCard
                key={post.id}
                post={post}
                isLiked={post.isLiked || false}
                onLikeToggle={handleLikeToggle}
                onFetchComments={onFetchComments}
                allFetchedComments={allFetchedComments}
                updateCommentSummaryInCache={updateCommentSummaryInCache} // Pass new function
                className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                style={{ animationDelay: `${index * 50}ms` }}
              />
            ))}
          </>
        ) : allPosts.length > 0 && filteredPosts.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400 text-lg animate-in fade-in duration-500">No posts found for the selected subreddit.</p>
        ) : null}
      </div>

      <MadeWithDyad />
    </div>
  );
};

export default Index;