"use client";

import { useState, useCallback, useMemo } from "react";
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
import { Input } from "@/components/ui/input"; // Import Input component
import { Label } from "@/components/ui/label"; // Import Label component

interface Post {
  id: string;
  subreddit: string;
  title: string;
  selftext: string;
  url: string;
  aiSummary?: string;
  isLiked?: boolean;
}

// Define interfaces for the new comment data structure (copied from PostCard for consistency)
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
}

// Define props for the Index component
interface IndexProps {
  allPosts: Post[];
  setAllPosts: React.Dispatch<React.SetStateAction<Post[]>>;
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  handleLikeToggle: (postId: string) => void;
  selectedSubreddit: string; // New prop
  setSelectedSubreddit: React.Dispatch<React.SetStateAction<string>>; // New prop
}

const Index: React.FC<IndexProps> = ({
  allPosts,
  setAllPosts,
  isLoading,
  setIsLoading,
  handleLikeToggle,
  selectedSubreddit,
  setSelectedSubreddit,
}) => {
  const navigate = useNavigate();

  // New state for form inputs
  const [subreddit1, setSubreddit1] = useState<string>("");
  const [subreddit2, setSubreddit2] = useState<string>("");
  const [postType1, setPostType1] = useState<string>("hot"); // Default to 'hot' for subreddit 1
  const [postType2, setPostType2] = useState<string>("hot"); // Default to 'hot' for subreddit 2
  const [numPosts1, setNumPosts1] = useState<string>("10"); // Default to 10, store as string for Select
  const [numPosts2, setNumPosts2] = useState<string>("10"); // Default to 10, store as string for Select

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
    downloadHtmlFile(likedPosts, "liked_reddit_posts.html");
    showSuccess(`Downloaded ${likedPosts.length} liked posts as HTML.`);
  }, [likedPosts]);

  const handleGetRoadmap = useCallback(() => {
    if (likedPosts.length === 0) {
      showError("Please like at least one post to get a roadmap.");
      return;
    }
    navigate("/roadmap");
  }, [likedPosts, navigate]);

  const isFormValid =
    subreddit1.trim() !== "" &&
    subreddit2.trim() !== "" &&
    postType1 !== "" &&
    postType2 !== "" &&
    numPosts1 !== "" &&
    numPosts2 !== "";

  const triggerWebhook = useCallback(async () => {
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
          postType1: postType1, // Send postType1
          postType2: postType2, // Send postType2
          numPosts1: parseInt(numPosts1),
          numPosts2: parseInt(numPosts2),
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Webhook failed with status ${response.status}: ${errorData}`);
      }

      const rawData = await response.json();
      const finalOutput = rawData[0];

      if (!finalOutput || !finalOutput.allLinkedPosts) {
        throw new Error("Unexpected data structure from webhook: missing allLinkedPosts.");
      }

      const combinedPosts: Post[] = finalOutput.allLinkedPosts.map((post: any) => {
        return {
          id: post.id, // Use the ID from the webhook data
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
  }, [setAllPosts, setIsLoading, subreddit1, subreddit2, postType1, postType2, numPosts1, numPosts2]);

  const handleFetchComments = useCallback(async (postId: string, subreddit: string): Promise<CommentsResponse | null> => { // Updated return type
    const toastId = showLoading("Fetching comments...");
    try {
      const response = await fetch(import.meta.env.VITE_REDDIT_COMMENTS_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ postId, subreddit }), // Include subreddit in payload
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Comments webhook failed with status ${response.status}: ${errorData}`);
      }

      const rawData = await response.json();
      // Assuming the comments are directly in the first element of the array
      const commentsData: CommentsResponse = rawData[0]; 
      showSuccess("Comments fetched successfully!");
      return commentsData;
    } catch (error) {
      console.error("Error fetching comments:", error);
      showError(`Failed to fetch comments: ${error instanceof Error ? error.message : String(error)}`);
      return null; // Return null on error
    } finally {
      dismissToast(toastId);
    }
  }, []);

  return (
    <div className="container mx-auto py-8 px-4 flex flex-col items-center min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Card className="w-full max-w-3xl mb-8 shadow-lg animate-in fade-in slide-in-from-top-8 duration-700">
        <CardHeader className="text-center">
          <CardTitle className="text-4xl font-extrabold tracking-tight lg:text-5xl">
            Reddit Post Explorer
          </CardTitle>
          <CardDescription className="mt-2 text-lg text-gray-600 dark:text-gray-400">
            Discover, summarize, and plan projects from Reddit posts.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-xl">
            <div className="space-y-2">
              <Label htmlFor="subreddit1">{subreddit1.trim() !== "" ? subreddit1 : "Subreddit 1"}</Label>
              <Input
                id="subreddit1"
                placeholder="e.g., programming"
                value={subreddit1}
                onChange={(e) => setSubreddit1(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subreddit2">{subreddit2.trim() !== "" ? subreddit2 : "Subreddit 2"}</Label>
              <Input
                id="subreddit2"
                placeholder="e.g., webdev"
                value={subreddit2}
                onChange={(e) => setSubreddit2(e.target.value)}
              />
            </div>
            {/* Separate Post Type Select for Subreddit 1 */}
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
            {/* Separate Post Type Select for Subreddit 2 */}
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

          <Button
            onClick={triggerWebhook}
            disabled={isLoading || !isFormValid}
            className={cn(
              "px-8 py-4 text-lg font-semibold transition-all duration-300",
              (isLoading || !isFormValid) ? "bg-gray-400 dark:bg-gray-600 cursor-not-allowed" : "hover:scale-105 active:scale-95"
            )}
          >
            {isLoading ? "Fetching Posts..." : "Fetch Reddit Posts"}
          </Button>
          {isLoading && (
            <div className="w-full max-w-md space-y-2 animate-in fade-in duration-500">
              <Progress value={null} className="w-full h-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading posts and AI summaries...</p>
            </div>
          )}
        </CardContent>
      </Card>

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
                onFetchComments={handleFetchComments} // Pass the new function
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