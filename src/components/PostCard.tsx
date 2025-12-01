"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Heart, MessageSquare, RefreshCw, Link as LinkIcon, ArrowUpRight, Lightbulb, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { showLoading, showSuccess, showError, dismissToast } from "@/utils/toast";
import { useAiUsage } from "@/context/AiUsageContext";
import { supabase } from "@/lib/supabase";

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

interface PostCardProps {
  post: {
    id: string;
    subreddit: string;
    title: string;
    selftext: string;
    url: string;
    aiSummary?: string;
  };
  isLiked: boolean;
  onLikeToggle: (postId: string) => void;
  onFetchComments: (postId: string, subreddit: string) => Promise<CommentsResponse | null>;
  allFetchedComments: Record<string, CommentsResponse | null>;
  updateCommentSummaryInCache: (postId: string, commentId: string, summary: string | null) => void;
  className?: string;
  style?: React.CSSProperties;
}

const MAX_COMMENTS_FOR_INLINE_DISPLAY = 50;
const LONG_COMMENT_THRESHOLD = 250;

const PostCard: React.FC<PostCardProps> = ({ post, isLiked, onLikeToggle, onFetchComments, allFetchedComments, updateCommentSummaryInCache, className, style }) => {
  const navigate = useNavigate();
  const { recordRequest, incrementRequest } = useAiUsage();
  const [isPostContentOpen, setIsPostContentOpen] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isSummarizingComment, setIsSummarizingComment] = useState<Record<string, boolean>>({});
  const [commentSummaries, setCommentSummaries] = useState<Record<string, string | null>>(() => {
    return allFetchedComments[post.id]?.commentSummaries || {};
  });
  const [showCommentSummary, setShowCommentSummary] = useState<Record<string, boolean>>({});
  const [isAnimatingLike, setIsAnimatingLike] = useState(false);
  const [isSavingComment, setIsSavingComment] = useState<Record<string, boolean>>({});
  const [isCommentBodyOpen, setIsCommentBodyOpen] = useState<Record<string, boolean>>({});
  
  const commentsData = allFetchedComments[post.id];
  const totalComments = commentsData?.combinedSummary.totalComments || 0;
  const commentsTooLarge = totalComments > MAX_COMMENTS_FOR_INLINE_DISPLAY;

  useEffect(() => {
    if (commentsData) {
      setCommentSummaries(commentsData.commentSummaries || {});
    }
  }, [commentsData]);

  const decodeHtml = (html: string) => {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = html;
    return textarea.value;
  };

  const fetchAndSetComments = async () => {
    setIsLoadingComments(true);
    setShowComments(true);
    try {
      const fetchedComments = await onFetchComments(post.id, post.subreddit);
      if (!fetchedComments) {
        setShowComments(false);
      }
    } catch (error) {
      console.error(`[PostCard ${post.id}] Error fetching comments:`, error);
      setShowComments(false);
    } finally {
      setIsLoadingComments(false);
    }
  };

  const handleShowCommentsClick = async () => {
    if (commentsData && commentsData.combinedSummary.totalComments > MAX_COMMENTS_FOR_INLINE_DISPLAY) {
      navigate(`/posts/${post.subreddit}/${post.id}/comments`);
    } else if (!commentsData) {
      await fetchAndSetComments();
    } else {
      setShowComments(prev => !prev);
    }
  };

  const handleReloadComments = async () => {
    await fetchAndSetComments();
  };

  const handleSummarizeComment = useCallback(async (commentId: string, commentBody: string) => {
    if (commentSummaries[commentId]) {
      setShowCommentSummary(prev => ({ ...prev, [commentId]: !prev[commentId] }));
      return;
    }

    if (!recordRequest()) {
      return;
    }

    setIsSummarizingComment(prev => ({ ...prev, [commentId]: true }));
    const toastId = showLoading("Summarizing comment...");

    try {
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
      
      setCommentSummaries(prev => {
        const newSummaries = { ...prev, [commentId]: summary };
        updateCommentSummaryInCache(post.id, commentId, summary);
        return newSummaries;
      });
      setShowCommentSummary(prev => ({ ...prev, [commentId]: true }));
      showSuccess("Comment summarized!");

    } catch (error) {
      console.error("Error summarizing comment:", error);
      showError(`Failed to summarize comment: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      dismissToast(toastId);
      setIsSummarizingComment(prev => ({ ...prev, [commentId]: false }));
    }
  }, [commentSummaries, recordRequest, incrementRequest, post.id, updateCommentSummaryInCache]);

  const handleLikeButtonClick = useCallback(() => {
    onLikeToggle(post.id);
    setIsAnimatingLike(true);
    setTimeout(() => setIsAnimatingLike(false), 300);
  }, [onLikeToggle, post.id]);

  const handleSaveComment = useCallback(async (comment: Comment) => {
    setIsSavingComment(prev => ({ ...prev, [comment.id]: true }));
    const toastId = showLoading("Saving comment...");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showError("You must be logged in to save comments.");
        setIsSavingComment(prev => ({ ...prev, [comment.id]: false }));
        dismissToast(toastId);
        return;
      }

      const { error } = await supabase
        .from('saved_comments')
        .upsert({
          user_id: user.id,
          post_id: post.id,
          comment_id: comment.id,
          subreddit: post.subreddit,
          comment_body: comment.body,
          comment_author: comment.author,
          comment_score: comment.score,
          comment_created: comment.created,
          comment_permalink: comment.permalink,
          ai_summary: commentSummaries[comment.id] || null,
        }, { onConflict: 'comment_id' });

      if (error) {
        throw new Error(error.message);
      }

      showSuccess("Comment saved successfully!");
    } catch (error) {
      console.error("Error saving comment:", error);
      showError(`Failed to save comment: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      dismissToast(toastId);
      setIsSavingComment(prev => ({ ...prev, [comment.id]: false }));
    }
  }, [post, commentSummaries]);

  const toggleCommentBody = useCallback((commentId: string) => {
    setIsCommentBodyOpen(prev => ({ ...prev, [commentId]: !prev[commentId] }));
  }, []);

  return (
    <Card className={cn("w-full max-w-2xl mb-6 shadow-md", className)} style={style}>
      <CardHeader className="relative">
        <div className="flex justify-between items-start">
          <div className="flex-grow">
            <CardTitle className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
              {post.title}
            </CardTitle>
            <CardDescription className="text-sm text-gray-500 dark:text-gray-400">
              Subreddit: r/{post.subreddit}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLikeButtonClick}
            className={cn(
              "ml-4 transition-all duration-200 ease-out",
              isLiked ? "text-red-500 hover:text-red-600" : "text-gray-400 hover:text-red-500",
              isAnimatingLike && "scale-125"
            )}
            aria-label={isLiked ? "Unlike post" : "Like post"}
          >
            <Heart key={isLiked ? "liked" : "unliked"} fill={isLiked ? "currentColor" : "none"} className="h-7 w-7" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {post.aiSummary && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-200 dark:border-blue-800 animate-in fade-in duration-500">
            <h3 className="font-medium text-blue-700 dark:text-blue-300">AI Summary:</h3>
            <p className="text-blue-600 dark:text-blue-400">{post.aiSummary}</p>
          </div>
        )}

        <Collapsible open={isPostContentOpen} onOpenChange={setIsPostContentOpen} className="w-full space-y-2">
          <div className="flex items-center justify-between space-x-4 px-4">
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">
              Full Post Details
            </h3>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-9 p-0">
                {isPostContentOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                <span className="sr-only">Toggle full post</span>
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="space-y-2 px-4 pb-4">
            <div className="text-gray-700 dark:text-gray-300 text-left">
              <p dangerouslySetInnerHTML={{ __html: decodeHtml(post.selftext) }} className="whitespace-pre-wrap"></p>
            </div>
            {post.url && (
              <a
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline mt-4 block text-right"
              >
                Read more on Reddit
              </a>
            )}
            <Button
              variant="outline"
              onClick={() => setIsPostContentOpen(false)}
              className="w-full mt-4"
            >
              Hide Details
            </Button>
          </CollapsibleContent>
        </Collapsible>

        <div className="mt-4 px-4 flex gap-2">
          <Button
            variant="outline"
            onClick={handleShowCommentsClick}
            disabled={isLoadingComments}
            className="flex-1 flex items-center justify-center gap-2"
          >
            {isLoadingComments ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 dark:border-gray-100"></span>
                Fetching Comments...
              </>
            ) : commentsTooLarge ? (
              <>
                <MessageSquare className="h-4 w-4" />
                Comments too large, view in new page? ({totalComments})
              </>
            ) : (
              <>
                <MessageSquare className="h-4 w-4" />
                {showComments ? "Hide Comments" : `Show Comments (${totalComments})`}
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleReloadComments}
            disabled={isLoadingComments}
            className="flex-none flex items-center justify-center gap-2"
            title="Reload Comments"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="sr-only">Reload Comments</span>
          </Button>
        </div>

        {showComments && !commentsTooLarge && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 text-left animate-in fade-in duration-300">
            <h4 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">Comments:</h4>
            {isLoadingComments ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            ) : commentsData && commentsData.individualThreads.length > 0 ? (
              <>
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

                {commentsData.individualThreads.map((thread, threadIndex) => (
                  <div key={threadIndex} className="comment-thread mb-6">
                    {thread.comments.map(comment => {
                      const isLongComment = comment.body.length > LONG_COMMENT_THRESHOLD;
                      const isBodyOpen = isCommentBodyOpen[comment.id] || false;
                      return (
                        <div
                          key={comment.id}
                          className="comment group"
                          style={{ marginLeft: comment.depth * 24 + 'px' }}
                        >
                          <div className="comment-header flex items-center gap-2 text-sm mb-1">
                            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                              {comment.author.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-semibold text-gray-900 dark:text-gray-100">
                              {comment.author}
                            </span>
                            <span className="text-gray-500 mx-1">•</span>
                            <span className="text-orange-500 font-medium">▲ {comment.score}</span>
                          </div>
                          <div className="flex items-center gap-1 mb-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleSummarizeComment(comment.id, comment.body)}
                              disabled={isSummarizingComment[comment.id]}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-blue-500"
                              title={commentSummaries[comment.id] ? (showCommentSummary[comment.id] ? "Hide Summary" : "Show Summary") : "Summarize Comment"}
                            >
                              {isSummarizingComment[comment.id] ? (
                                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 dark:border-gray-100"></span>
                              ) : (
                                <Lightbulb className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleSaveComment(comment)}
                              disabled={isSavingComment[comment.id]}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-green-500"
                              title="Save Comment"
                            >
                              {isSavingComment[comment.id] ? (
                                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 dark:border-gray-100"></span>
                              ) : (
                                <Bookmark className="h-4 w-4" />
                              )}
                            </Button>
                            <a
                              href={comment.permalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 hover:text-blue-700 p-2 rounded-md"
                              title="Open on Reddit"
                            >
                              <LinkIcon className="h-4 w-4" />
                            </a>
                          </div>

                          <div className="comment-body text-gray-700 dark:text-gray-300 text-sm leading-relaxed prose prose-sm dark:prose-invert">
                            {isLongComment ? (
                              <Collapsible open={isBodyOpen} onOpenChange={() => toggleCommentBody(comment.id)}>
                                <CollapsibleContent className={cn("overflow-hidden transition-all duration-300 ease-in-out", !isBodyOpen && "max-h-[4.5em]")}>
                                  <p dangerouslySetInnerHTML={{ __html: decodeHtml(comment.body) }}></p>
                                </CollapsibleContent>
                                <CollapsibleTrigger asChild>
                                  <Button variant="link" size="sm" className="h-auto p-0 text-blue-500 dark:text-blue-400">
                                    {isBodyOpen ? "Show less" : "Read more"}
                                  </Button>
                                </CollapsibleTrigger>
                              </Collapsible>
                            ) : (
                              <p dangerouslySetInnerHTML={{ __html: decodeHtml(comment.body) }}></p>
                            )}
                          </div>

                          {commentSummaries[comment.id] && showCommentSummary[comment.id] && (
                            <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-md border border-yellow-200 dark:border-yellow-800 animate-in fade-in duration-300">
                              <h5 className="font-medium text-yellow-700 dark:text-yellow-300 text-xs mb-1">AI Summary:</h5>
                              <p className="text-yellow-600 dark:text-yellow-400 text-sm">{commentSummaries[comment.id]}</p>
                            </div>
                          )}

                          <div className="comment-footer">
                            <span className="text-xs text-gray-500 dark:text-gray-400">{comment.created}</span>
                          </div>
                        </div>
                      );
                    })}

                    {threadIndex < commentsData.individualThreads.length - 1 && (
                      <div className="border-t border-gray-200 dark:border-gray-700 my-4"></div>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  onClick={() => setShowComments(false)}
                  className="w-full mt-4"
                >
                  Hide Comments
                </Button>
              </>
            ) : (
              <p className="text-gray-600 dark:text-gray-400">No comments found for this post.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PostCard;