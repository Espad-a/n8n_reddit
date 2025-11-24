"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { showLoading, showSuccess, showError, dismissToast } from "@/utils/toast";
import { ArrowLeft, Link as LinkIcon, RefreshCw, ArrowUpRight } from "lucide-react"; // Import ArrowUpRight
import { cn } from "@/lib/utils";

// Define interfaces for the new comment data structure
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

const FullCommentsPage: React.FC = () => {
  const { postId, subreddit } = useParams<{ postId: string; subreddit: string }>();
  const navigate = useNavigate();
  const [commentsData, setCommentsData] = useState<CommentsResponse | null>(null);
  const [isLoadingComments, setIsLoadingComments] = useState(true);

  // Simple function to decode HTML entities for comment bodies
  const decodeHtml = (html: string) => {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = html;
    return textarea.value;
  };

  const fetchComments = useCallback(async () => {
    if (!postId || !subreddit) {
      showError("Post ID or Subreddit is missing.");
      setIsLoadingComments(false);
      return;
    }

    setIsLoadingComments(true);
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
      const fetchedData: CommentsResponse = rawData[0];
      setCommentsData(fetchedData);
      showSuccess("Comments fetched successfully!");
    } catch (error) {
      console.error("Error fetching comments:", error);
      showError(`Failed to fetch comments: ${error instanceof Error ? error.message : String(error)}`);
      setCommentsData(null);
    } finally {
      dismissToast(toastId);
      setIsLoadingComments(false);
    }
  }, [postId, subreddit]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  if (!postId || !subreddit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-950">
        <p className="text-lg text-gray-700 dark:text-gray-300">Invalid post or subreddit provided.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 flex flex-col items-center min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="w-full max-w-4xl flex justify-between items-center mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="flex items-center">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button
          variant="outline"
          onClick={fetchComments}
          disabled={isLoadingComments}
          className="flex items-center gap-2"
        >
          {isLoadingComments ? (
            <>
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 dark:border-gray-100"></span>
              Reloading...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Reload Comments
            </>
          )}
        </Button>
      </div>

      <Card className="w-full max-w-4xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">Comments for r/{subreddit}</CardTitle>
          <CardDescription className="text-center mt-2">
            Post ID: {postId}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoadingComments ? (
            <div className="space-y-4">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-16 w-full ml-8" />
              <Skeleton className="h-12 w-full ml-16" />
            </div>
          ) : commentsData && commentsData.individualThreads.length > 0 ? (
            <>
              {/* Summary Cards with Better Visuals */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-300">
                    {commentsData.combinedSummary.totalComments}
                  </div>
                  <div className="text-sm text-blue-700 dark:text-blue-400">Total Comments</div>
                </div>
                <div className="bg-green-50 dark:bg-green-900 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-300">
                    {commentsData.combinedSummary.totalUniqueAuthors}
                  </div>
                  <div className="text-sm text-green-700 dark:text-green-400">Unique Authors</div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-300">
                    {commentsData.combinedSummary.totalThreads}
                  </div>
                  <div className="text-sm text-purple-700 dark:text-purple-400">Threads</div>
                </div>
              </div>

              <div className="space-y-6">
                {commentsData.individualThreads.map((thread, threadIndex) => (
                  <div key={threadIndex} className="comment-thread border-l-2 border-gray-300 dark:border-gray-700 pl-4">
                    {thread.comments.map(comment => (
                      <div
                        key={comment.id}
                        className={cn(
                          "comment group", // Added group for hover states
                          comment.depth % 2 === 0 ? "bg-background dark:bg-gray-800" : "bg-muted dark:bg-gray-700",
                          "hover:shadow-md transition-shadow duration-200"
                        )}
                        style={{ marginLeft: comment.depth * 15 + 'px' }} // Slightly reduced indentation for full page
                        data-author-initial={comment.author.charAt(0).toUpperCase()}
                      >
                        <div className="comment-header flex items-center gap-2 text-sm mb-2">
                          <div className="flex items-center gap-2 flex-1">
                            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                              {comment.author.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-semibold text-gray-900 dark:text-gray-100">
                              {comment.author}
                            </span>
                            <span className="text-gray-500">•</span>
                            <span className="text-orange-500 font-medium">▲ {comment.score}</span>
                            <span className="text-gray-500">•</span>
                            <span className="text-gray-500 text-xs">{comment.created}</span>
                          </div>
                          <a 
                            href={comment.permalink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 hover:text-blue-700"
                            title="Open on Reddit"
                          >
                            <LinkIcon className="h-4 w-4" />
                          </a>
                        </div>
                        <div className="comment-body text-sm text-gray-700 dark:text-gray-300">
                          <p dangerouslySetInnerHTML={{ __html: decodeHtml(comment.body) }}></p>
                        </div>
                        {comment.depth > 0 && (
                          <div className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                            <ArrowUpRight className="h-3 w-3" />
                            Replying to parent comment
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-gray-600 dark:text-gray-400 text-center text-lg">No comments found for this post.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FullCommentsPage;