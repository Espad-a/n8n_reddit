import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import RoadmapPage from "./pages/RoadmapPage";
import Header from "./components/Header";
import React, { useState, useCallback, useMemo } from "react";
import FullCommentsPage from "./pages/FullCommentsPage";
import ScrollToTopButton from "./components/ScrollToTopButton";
import { showLoading, showSuccess, showError, dismissToast } from "./utils/toast"; // Changed to relative path
import { AiUsageProvider } from "./context/AiUsageContext"; // Import the new provider
import SavedPostsPage from "./pages/SavedPostsPage"; // Import the new SavedPostsPage

// Define the Post interface here as it's now used in App.tsx
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
  commentSummaries?: Record<string, string | null>; // Added to store AI summaries for comments
}

const queryClient = new QueryClient();

const App = () => {
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSubreddit, setSelectedSubreddit] = useState<string>("all");
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [roadmapMarkdown, setRoadmapMarkdown] = useState<string | null>(null);
  const [isLoadingRoadmap, setIsLoadingRoadmap] = useState(false);
  // New state to store all fetched comments, keyed by postId
  const [allFetchedComments, setAllFetchedComments] = useState<Record<string, CommentsResponse | null>>({});

  const handleLikeToggle = useCallback((postId: string) => {
    setAllPosts(prevPosts =>
      prevPosts.map(post =>
        post.id === postId ? { ...post, isLiked: !post.isLiked } : post
      )
    );
  }, []);

  const likedPosts = useMemo(() => {
    return allPosts.filter(post => post.isLiked);
  }, [allPosts]);

  // Centralized function to fetch comments and update the global state
  const fetchCommentsAndCache = useCallback(async (postId: string, subreddit: string): Promise<CommentsResponse | null> => {
    const toastId = showLoading("Fetching comments...");
    try {
      const response = await fetch(import.meta.env.VITE_REDDIT_COMMENTS_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ postId, subreddit }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Comments webhook failed with status ${response.status}: ${errorData}`);
      }

      const rawData = await response.json();
      const commentsData: CommentsResponse = rawData[0];
      setAllFetchedComments(prev => ({ ...prev, [postId]: commentsData })); // Cache the fetched data
      showSuccess("Comments fetched successfully!");
      return commentsData;
    } catch (error) {
      console.error("Error fetching comments:", error);
      showError(`Failed to fetch comments: ${error instanceof Error ? error.message : String(error)}`);
      setAllFetchedComments(prev => ({ ...prev, [postId]: null })); // Store null on error
      return null;
    } finally {
      dismissToast(toastId);
    }
  }, []);

  // New function to update comment summaries in the global cache
  const updateCommentSummaryInCache = useCallback((postId: string, commentId: string, summary: string | null) => {
    setAllFetchedComments(prev => {
      const postComments = prev[postId];
      if (!postComments) return prev;

      const updatedCommentSummaries = {
        ...(postComments.commentSummaries || {}),
        [commentId]: summary,
      };

      return {
        ...prev,
        [postId]: {
          ...postComments,
          commentSummaries: updatedCommentSummaries,
        },
      };
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AiUsageProvider> {/* Wrap the entire app with the AI Usage Provider */}
            <div className="flex flex-col min-h-screen">
              <Header />
              <main className="flex-grow">
                <Routes>
                  <Route
                    path="/"
                    element={
                      <Index
                        allPosts={allPosts}
                        setAllPosts={setAllPosts}
                        isLoading={isLoading}
                        setIsLoading={setIsLoading}
                        handleLikeToggle={handleLikeToggle}
                        selectedSubreddit={selectedSubreddit}
                        setSelectedSubreddit={setSelectedSubreddit}
                        allFetchedComments={allFetchedComments} // Pass new state
                        onFetchComments={fetchCommentsAndCache} // Pass new function
                        updateCommentSummaryInCache={updateCommentSummaryInCache} // Pass new function
                      />
                    }
                  />
                  <Route
                    path="/roadmap"
                    element={
                      <RoadmapPage
                        likedPosts={likedPosts}
                        selectedPostId={selectedPostId}
                        setSelectedPostId={setSelectedPostId}
                        roadmapMarkdown={roadmapMarkdown}
                        setRoadmapMarkdown={setRoadmapMarkdown}
                        isLoadingRoadmap={isLoadingRoadmap}
                        setIsLoadingRoadmap={setIsLoadingRoadmap}
                      />
                    }
                  />
                  <Route
                    path="/posts/:subreddit/:postId/comments"
                    element={
                      <FullCommentsPage
                        allFetchedComments={allFetchedComments} // Pass new state
                        onFetchComments={fetchCommentsAndCache} // Pass new function
                        updateCommentSummaryInCache={updateCommentSummaryInCache} // Pass new function
                      />
                    }
                  />
                  <Route path="/saved-posts" element={<SavedPostsPage />} /> {/* New route for SavedPostsPage */}
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </main>
              <ScrollToTopButton />
            </div>
          </AiUsageProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;