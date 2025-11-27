"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Link as LinkIcon, Lightbulb, ExternalLink } from "lucide-react";
import { showLoading, showSuccess, showError, dismissToast } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { useAiUsage } from "@/context/AiUsageContext";

// Re-using interfaces from App.tsx/PostCard.tsx for consistency
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
  commentSummaries?: Record<string, string | null>;
}

interface FullCommentsPageProps {
  allFetchedComments: Record<string, CommentsResponse | null>;
  onFetchComments: (postId: string, subreddit: string) => Promise<CommentsResponse | null>;
  updateCommentSummaryInCache: (postId: string, commentId: string, summary: string | null) => void;
}

const FullCommentsPage: React.FC<FullCommentsPageProps> = ({ allFetchedComments, onFetchComments, updateCommentSummaryInCache }) => {
  const { subreddit, postId } = useParams<{ subreddit: string; postId: string }>();
  const navigate = useNavigate();
  const { recordRequest, incrementRequest } = useAiUsage();

  const [isLoadingComments, setIsLoadingComments] = useState(true);
  const [commentsData, setCommentsData] = useState<CommentsResponse | null>(null);
  const [isSummarizingComment, setIsSummarizingComment] = useState<Record<string, boolean>>({});
  const [showCommentSummary, setShowCommentSummary] = useState<Record<string, boolean>>({});

  const decodeHtml = (html: string) => {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = html;
    return textarea.value;
  };

  const fetchAndSetComments = useCallback(async () => {
    if (!postId || !subreddit) {
      showError("Invalid post or subreddit ID.");
      navigate("/");
      return;
    }

    setIsLoadingComments(true);
    // Check if comments are already in cache
    if (allFetchedComments[postId]) {
      setCommentsData(allFetchedComments[postId]);
      // Initialize showCommentSummary based on cached summaries
      const initialShowSummary: Record<string, boolean> = {};
      if (allFetchedComments[postId]?.commentSummaries) {
        Object.keys(allFetchedComments[postId]!.commentSummaries!).forEach(commentId => {
          initialShowSummary[commentId] = false; // Start hidden
        });
      }
      setShowCommentSummary(initialShowSummary);
      setIsLoadingComments(false);
      return;
    }

    // If not in cache, fetch them
    const fetchedComments = await onFetchComments(postId, subreddit);
    setCommentsData(fetchedComments);
    // Initialize showCommentSummary for newly fetched comments
    const initialShowSummary: Record<string, boolean> = {};
    if (fetchedComments?.commentSummaries) {
      Object.keys(fetchedComments.commentSummaries).forEach(commentId => {
        initialShowSummary[commentId] = false; // Start hidden
      });
    }
    setShowCommentSummary(initialShowSummary);
    setIsLoadingComments(false);
  }, [postId, subreddit, navigate, allFetchedComments, onFetchComments]);

  useEffect(() => {
    fetchAndSetComments();
  }, [fetchAndSetComments]);

  const handleSummarizeComment = useCallback(async (commentId: string, commentBody: string) => {
    // If summary already exists in the current commentsData, just toggle its visibility
    if (commentsData?.commentSummaries?.[commentId]) {
      setShowCommentSummary(prev => ({ ...prev, [commentId]: !prev[commentId] }));
      return;
    }

    if (!recordRequest()) {
      return;
    }

    setIsSummarizingComment(prev => ({ ...prev, [commentId]: true }));
    const toastId = showLoading("Summarizing comment...");

    try {
      // Use the single VITE_REDDIT_COMMENT_SUMMARY_WEBHOOK_URL, Vite will load the correct one based on mode
      const webhookUrl = import.meta.env.VITE_REDDIT_COMMENT_SUMMARY_WEBHOOK_URL;

      if (!webhookUrl) {
        throw new Error("Comment summary webhook URL is not configured.");
      }

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ commentBody }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Summary webhook failed with status ${response.status}: ${errorData}`);
      }

      incrementRequest();

      const rawData = await response.json();
      const summary = rawData[0]?.text || "No summary available.";

      // Update the local state for commentsData
      setCommentsData(prev => {
        if (!prev) return null;
        const updatedCommentSummaries = {
          ...(prev.commentSummaries || {}),
          [commentId]: summary,
        };
        return {
          ...prev,
          commentSummaries: updatedCommentSummaries,
        };
      });
      updateCommentSummaryInCache(postId!, commentId, summary); // Update global cache
      setShowCommentSummary(prev => ({ ...prev, [commentId]: true }));
      showSuccess("Comment summarized!");

    } catch (error) {
      console.error("Error summarizing comment:", error);
      showError(`Failed to summarize comment: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      dismissToast(toastId);
      setIsSummarizingComment(prev => ({ ...prev, [commentId]: false }));
    }
  }, [commentsData, recordRequest, incrementRequest, postId, updateCommentSummaryInCache]);

  if (isLoadingComments) {
    return (
      <div className="container mx-auto py-8 px-4 flex flex-col items-center min-h-screen bg-gray-50 dark:bg-gray-950">
        <Card className="w-full max-w-4xl shadow-lg">
          <CardHeader>
            <Skeleton className="h-8 w-3/4 mb-2" />
            <Skeleton className="h-5 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!commentsData) {
    return (
      <div className="container mx-auto py-8 px-4 flex flex-col items-center min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <div className="w-full max-w-4xl flex justify-start mb-6">
          <Button variant="ghost" onClick={() => navigate(-1)} className="flex items-center">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
        </div>
        <Card className="w-full max-w-4xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">Comments Not Found</CardTitle>
            <CardDescription className="text-center mt-2">
              We couldn't load comments for this post. It might have been deleted or an error occurred.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate("/")}>Return to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 flex flex-col items-center min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="w-full max-w-4xl flex justify-start mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="flex items-center">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </div>

      <Card className="w-full max-w-4xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">Comments for r/{subreddit}</CardTitle>
          <CardDescription className="text-center mt-2">
            Full discussion for post ID: {postId}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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

          {commentsData.individualThreads.length > 0 ? (
            commentsData.individualThreads.map((thread, threadIndex) => (
              <div key={threadIndex} className="comment-thread mb-6">
                {thread.comments.map(comment => (
                  <div
                    key={comment.id}
                    className="comment group"
                    style={{ marginLeft: comment.depth * 24 + 'px' }}
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
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSummarizeComment(comment.id, comment.body)}
                          disabled={isSummarizingComment[comment.id]}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-blue-500"
                          title={commentsData.commentSummaries?.[comment.id] ? (showCommentSummary[comment.id] ? "Hide Summary" : "Show Summary") : "Summarize Comment"}
                        >
                          {isSummarizingComment[comment.id] ? (
                            <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 dark:border-gray-100"></span>
                          ) : (
                            <Lightbulb className="h-4 w-4" />
                          )}
                        </Button>
                        <a
                          href={comment.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 hover:text-blue-700"
                          title="Open on Reddit"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </div>

                    <div className="comment-body text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                      <p dangerouslySetInnerHTML={{ __html: decodeHtml(comment.body) }}></p>
                    </div>

                    {commentsData.commentSummaries?.[comment.id] && showCommentSummary[comment.id] && (
                      <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-md border border-yellow-200 dark:border-yellow-800 animate-in fade-in duration-300">
                        <h5 className="font-medium text-yellow-700 dark:text-yellow-300 text-xs mb-1">AI Summary:</h5>
                        <p className="text-yellow-600 dark:text-yellow-400 text-sm">{commentsData.commentSummaries[comment.id]}</p>
                      </div>
                    )}
                  </div>
                ))}

                {threadIndex < commentsData.individualThreads.length - 1 && (
                  <div className="border-t border-gray-200 dark:border-gray-700 my-4"></div>
                )}
              </div>
            ))
          ) : (
            <p className="text-gray-600 dark:text-gray-400 text-center text-lg">No comments found for this post.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FullCommentsPage;