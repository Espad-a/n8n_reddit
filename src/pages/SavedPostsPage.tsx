"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { showLoading, showSuccess, showError, dismissToast } from "@/utils/toast";
import { ArrowLeft, Trash2, ExternalLink, MessageSquare, Lightbulb } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp } from "lucide-react";

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
  commentSummaries?: Record<string, string | null>; // Added to store AI summaries for comments
}

interface SavedPost {
  id: string; // UUID from Supabase
  post_id: string; // Original Reddit post ID
  subreddit: string;
  title: string;
  selftext: string;
  url: string;
  ai_summary?: string;
  comments_data?: CommentsResponse | null;
  created_at: string;
}

const SavedPostsPage: React.FC = () => {
  const navigate = useNavigate();
  const [savedPosts, setSavedPosts] = useState<SavedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null); // Track which post is being deleted
  const [openPostContent, setOpenPostContent] = useState<Record<string, boolean>>({}); // For post selftext
  const [showCommentsState, setShowCommentsState] = useState<Record<string, boolean>>({}); // For comments section
  const [commentSummaries, setCommentSummaries] = useState<Record<string, string | null>>({}); // New state for summaries
  const [showCommentSummary, setShowCommentSummary] = useState<Record<string, boolean>>({}); // New state for summary visibility

  const fetchSavedPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      // Removed user authentication check as per request
      const { data, error } = await supabase
        .from('saved_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      setSavedPosts(data || []);
      showSuccess("Saved posts loaded!");
    } catch (error) {
      console.error("Error fetching saved posts:", error);
      showError(`Failed to load saved posts: ${error instanceof Error ? error.message : String(error)}`);
      setSavedPosts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSavedPosts();
  }, [fetchSavedPosts]);

  // Initialize commentSummaries and showCommentSummary from fetched savedPosts
  useEffect(() => {
    if (savedPosts.length > 0) {
      const initialCommentSummaries: Record<string, string | null> = {};
      const initialShowCommentSummary: Record<string, boolean> = {};
      savedPosts.forEach(post => {
        if (post.comments_data?.commentSummaries) {
          Object.assign(initialCommentSummaries, post.comments_data.commentSummaries);
          // Optionally, set all fetched summaries to be visible by default, or keep them hidden
          Object.keys(post.comments_data.commentSummaries).forEach(commentId => {
            initialShowCommentSummary[commentId] = false; // Start hidden
          });
        }
      });
      setCommentSummaries(initialCommentSummaries);
      setShowCommentSummary(initialShowCommentSummary);
    }
  }, [savedPosts]);

  const handleDeletePost = useCallback(async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}" from your saved posts?`)) {
      return;
    }

    setIsDeleting(id);
    const toastId = showLoading("Deleting post...");

    try {
      const { error } = await supabase
        .from('saved_posts')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(error.message);
      }

      setSavedPosts(prev => prev.filter(post => post.id !== id));
      showSuccess("Post deleted successfully!");
    } catch (error) {
      console.error("Error deleting post:", error);
      showError(`Failed to delete post: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      dismissToast(toastId);
      setIsDeleting(null);
    }
  }, []);

  const decodeHtml = (html: string) => {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = html;
    return textarea.value;
  };

  const handleTogglePostContent = useCallback((postId: string, open: boolean) => {
    setOpenPostContent(prev => ({ ...prev, [postId]: open }));
  }, []);

  const handleToggleComments = useCallback((postId: string, open: boolean) => {
    setShowCommentsState(prev => ({ ...prev, [postId]: open }));
  }, []);

  const handleSummarizeComment = useCallback((commentId: string) => {
    // This function now only toggles the visibility of *already saved* summaries.
    // New summarization is expected to happen on the main posts page.
    if (commentSummaries[commentId]) {
      setShowCommentSummary(prev => ({ ...prev, [commentId]: !prev[commentId] }));
    } else {
      showError("No AI summary found for this comment. Summaries are generated on the main posts page.");
    }
  }, [commentSummaries]);

  return (
    <div className="container mx-auto py-8 px-4 flex flex-col items-center min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="w-full max-w-4xl flex justify-start mb-6">
        <Button variant="ghost" onClick={() => navigate("/")} className="flex items-center">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
        </Button>
      </div>

      <Card className="w-full max-w-4xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">Your Saved Posts</CardTitle>
          <CardDescription className="text-center mt-2">
            Manage your collection of interesting Reddit posts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="w-full shadow-md">
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
          ) : savedPosts.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center text-lg">
              You haven't saved any posts yet. Go back to the home page and like some posts!
            </p>
          ) : (
            savedPosts.map((post) => (
              <Card key={post.id} className="w-full shadow-md relative">
                <CardHeader className="relative">
                  <div className="flex justify-between items-start">
                    <div className="flex-grow">
                      <CardTitle className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
                        {post.title}
                      </CardTitle>
                      <CardDescription className="text-sm text-gray-500 dark:text-gray-400">
                        Subreddit: r/{post.subreddit} • Saved on: {new Date(post.created_at).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDeletePost(post.id, post.title)}
                      disabled={isDeleting === post.id}
                      className="ml-4"
                      aria-label="Delete post"
                    >
                      {isDeleting === post.id ? (
                        <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                      ) : (
                        <Trash2 className="h-5 w-5" />
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {post.ai_summary && (
                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-md border border-blue-200 dark:border-blue-800 animate-in fade-in duration-500">
                      <h3 className="font-medium text-blue-700 dark:text-blue-300">AI Summary:</h3>
                      <p className="text-blue-600 dark:text-blue-400">{post.ai_summary}</p>
                    </div>
                  )}

                  <Collapsible open={openPostContent[post.id] || false} onOpenChange={(open) => handleTogglePostContent(post.id, open)} className="w-full space-y-2">
                    <div className="flex items-center justify-between space-x-4 px-4">
                      <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">
                        Full Post Details
                      </h3>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-9 p-0">
                          {openPostContent[post.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
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
                          Read more on Reddit <ExternalLink className="inline-block h-4 w-4 ml-1" />
                        </a>
                      )}
                      <Button
                        variant="outline"
                        onClick={() => handleTogglePostContent(post.id, false)}
                        className="w-full mt-4"
                      >
                        Hide Details
                      </Button>
                    </CollapsibleContent>
                  </Collapsible>

                  {post.comments_data && post.comments_data.combinedSummary.totalComments > 0 && (
                    <div className="mt-4 px-4">
                      <Button
                        variant="outline"
                        onClick={() => handleToggleComments(post.id, !showCommentsState[post.id])}
                        className="w-full flex items-center justify-center gap-2"
                      >
                        <MessageSquare className="h-4 w-4" />
                        {showCommentsState[post.id] ? "Hide Comments" : `Show Comments (${post.comments_data.combinedSummary.totalComments})`}
                      </Button>
                    </div>
                  )}

                  {showCommentsState[post.id] && post.comments_data && post.comments_data.individualThreads.length > 0 && (
                    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 text-left animate-in fade-in duration-300">
                      <h4 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">Comments:</h4>
                      <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg text-center">
                          <div className="text-2xl font-bold text-blue-600 dark:text-blue-300">
                            {post.comments_data.combinedSummary.totalComments}
                          </div>
                          <div className="text-sm text-blue-700 dark:text-blue-400">Total Comments</div>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900 p-4 rounded-lg text-center">
                          <div className="text-2xl font-bold text-green-600 dark:text-green-300">
                            {post.comments_data.combinedSummary.totalUniqueAuthors}
                          </div>
                          <div className="text-sm text-green-700 dark:text-green-400">Unique Authors</div>
                        </div>
                        <div className="bg-purple-50 dark:bg-purple-900 p-4 rounded-lg text-center">
                          <div className="text-2xl font-bold text-purple-600 dark:text-purple-300">
                            {post.comments_data.combinedSummary.totalThreads}
                          </div>
                          <div className="text-sm text-purple-700 dark:text-purple-400">Threads</div>
                        </div>
                      </div>

                      {post.comments_data.individualThreads.map((thread, threadIndex) => (
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
                                  {/* AI Summary button for comments - now toggles visibility of saved summaries */}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleSummarizeComment(comment.id)}
                                    disabled={!commentSummaries[comment.id]} // Disable if no summary exists
                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-blue-500"
                                    title={commentSummaries[comment.id] ? (showCommentSummary[comment.id] ? "Hide Summary" : "Show Summary") : "No AI Summary"}
                                  >
                                    <Lightbulb className="h-4 w-4" />
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

                              {commentSummaries[comment.id] && showCommentSummary[comment.id] && (
                                <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-md border border-yellow-200 dark:border-yellow-800 animate-in fade-in duration-300">
                                  <h5 className="font-medium text-yellow-700 dark:text-yellow-300 text-xs mb-1">AI Summary:</h5>
                                  <p className="text-yellow-600 dark:text-yellow-400 text-sm">{commentSummaries[comment.id]}</p>
                                </div>
                              )}

                              {comment.depth > 0 && (
                                <div className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                                  <ArrowLeft className="h-3 w-3" />
                                  Replying to parent comment
                                </div>
                              )}
                            </div>
                          ))}

                          {threadIndex < post.comments_data.individualThreads.length - 1 && (
                            <div className="border-t border-gray-200 dark:border-gray-700 my-4"></div>
                          )}
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        onClick={() => handleToggleComments(post.id, false)}
                        className="w-full mt-4"
                      >
                        Hide Comments
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          {/* <MadeWithDyad /> */}
        </CardFooter>
      </Card>
    </div>
  );
};

export default SavedPostsPage;