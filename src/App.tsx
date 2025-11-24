import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import RoadmapPage from "./pages/RoadmapPage";
import Header from "./components/Header";
import React, { useState, useCallback, useMemo } from "react"; // Import React and hooks
import FullCommentsPage from "./pages/FullCommentsPage"; // Import the new page

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

const queryClient = new QueryClient();

const App = () => {
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSubreddit, setSelectedSubreddit] = useState<string>("all"); // Lifted state
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null); // Lifted state
  const [roadmapMarkdown, setRoadmapMarkdown] = useState<string | null>(null); // Lifted state
  const [isLoadingRoadmap, setIsLoadingRoadmap] = useState(false); // Lifted state

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

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
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
                      selectedSubreddit={selectedSubreddit} // Pass lifted state
                      setSelectedSubreddit={setSelectedSubreddit} // Pass setter
                    />
                  }
                />
                <Route
                  path="/roadmap"
                  element={
                    <RoadmapPage
                      likedPosts={likedPosts} // Pass derived state
                      selectedPostId={selectedPostId} // Pass lifted state
                      setSelectedPostId={setSelectedPostId} // Pass setter
                      roadmapMarkdown={roadmapMarkdown} // Pass lifted state
                      setRoadmapMarkdown={setRoadmapMarkdown} // Pass setter
                      isLoadingRoadmap={isLoadingRoadmap} // Pass lifted state
                      setIsLoadingRoadmap={setIsLoadingRoadmap} // Pass setter
                    />
                  }
                />
                <Route path="/posts/:postId/comments" element={<FullCommentsPage />} /> {/* New route */}
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;