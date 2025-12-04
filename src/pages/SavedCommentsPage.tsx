"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { showLoading, showSuccess, showError, dismissToast } from "@/utils/toast";
import { ArrowLeft, Trash2, ExternalLink, Lightbulb } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { getCommentIndentationClass } from "@/utils/comment-utils"; // Import the new utility

interface SavedComment {
  id: string;
  user_id: string;
  post_id: string;
  comment_id: string;
  subreddit: string;
  comment_body: string;
  comment_author: string;
  comment_score: number;
  comment_created: string;
  comment_permalink?: string;
  ai_summary?: string;
  created_at: string;
}

const LONG_COMMENT_THRESHOLD = 250;

const SavedCommentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [savedComments, setSavedComments] = useState<SavedComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [showSummaryState, setShowSummaryState] = useState<Record<string, boolean>>({});
  const [isCommentBodyOpen, setIsCommentBodyOpen] = useState<Record<string, boolean>>({});

  const fetchSavedComments = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } = {} } = await supabase.auth.getUser();
      if (!user) {
        showError("You must be logged in to view saved comments.");
        navigate("/");
        return;
      }

      const { data, error } = await supabase
        .from('saved_comments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      setSavedComments(data || []);
      showSuccess("Saved comments loaded!");
    } catch (error) {
      console.error("Error fetching saved comments:", error);
      showError(`Failed to load saved comments: ${error instanceof Error ? error.message : String(error)}`);
      setSavedComments([]);
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchSavedComments();
  }, [fetchSavedComments]);

  const handleDeleteComment = useCallback(async (id: string, commentBody: string) => {
    if (!window.confirm(`Are you sure you want to delete this comment: "${commentBody.substring(0, 50)}..."?`)) {
      return;
    }

    setIsDeleting(id);
    const toastId = showLoading("Deleting comment...");

    try {
      const { error } = await supabase
        .from('saved_comments')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(error.message);
      }

      setSavedComments(prev => prev.filter(comment => comment.id !== id));
      showSuccess("Comment deleted successfully!");
    } catch (error) {
      console.error("Error deleting comment:", error);
      showError(`Failed to delete comment: ${error instanceof Error ? error.message : String(error)}`);
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

  const handleToggleSummary = useCallback((commentId: string) => {
    setShowSummaryState(prev => ({ ...prev, [commentId]: !prev[commentId] }));
  }, []);

  const toggleCommentBody = useCallback((commentId: string) => {
    setIsCommentBodyOpen(prev => ({ ...prev, [commentId]: !prev[commentId] }));
  }, []);

  return (
    <div className="container mx-auto py-8 px-4 flex flex-col items-center min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="w-full max-w-4xl flex justify-start mb-6">
        <Button variant="ghost" onClick={() => navigate("/")} className="flex items-center">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
        </Button>
      </div>

      <Card className="w-full max-w-4xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">Your Saved Comments</CardTitle>
          <CardDescription className="text-center mt-2">
            Manage your collection of interesting Reddit comments.
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
          ) : savedComments.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center text-lg">
              You haven't saved any comments yet.
            </p>
          ) : (
            savedComments.map((comment) => {
              const isLongComment = comment.comment_body.length > LONG_COMMENT_THRESHOLD;
              const isBodyOpen = isCommentBodyOpen[comment.id] || false;
              return (
                <Card key={comment.id} className="w-full shadow-md relative p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-grow">
                      <CardTitle className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                        Comment by {comment.comment_author}
                      </CardTitle>
                      <CardDescription className="text-sm text-gray-500 dark:text-gray-400">
                        From r/{comment.subreddit} • Score: {comment.comment_score} • Saved on: {new Date(comment.created_at).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDeleteComment(comment.id, comment.comment_body)}
                      disabled={isDeleting === comment.id}
                      className="ml-4 flex-shrink-0"
                      aria-label="Delete comment"
                    >
                      {isDeleting === comment.id ? (
                        <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                      ) : (
                        <Trash2 className="h-5 w-5" />
                      )}
                    </Button>
                  </div>

                  <div className={cn("text-gray-700 dark:text-gray-300 text-sm leading-relaxed mb-3 prose prose-sm dark:prose-invert", getCommentIndentationClass(0))}> {/* Apply base indentation */}
                    {isLongComment ? (
                      <Collapsible open={isBodyOpen} onOpenChange={() => toggleCommentBody(comment.id)}>
                        <CollapsibleContent className={cn("overflow-hidden transition-all duration-300 ease-in-out", !isBodyOpen && "max-h-[4.5em] comment-fade-bottom")}>
                          <p dangerouslySetInnerHTML={{ __html: decodeHtml(comment.comment_body) }}></p>
                        </CollapsibleContent>
                        <CollapsibleTrigger asChild>
                          <Button variant="link" size="sm" className="h-auto p-0 text-blue-500 dark:text-blue-400">
                            {isBodyOpen ? "Show less" : "Read more"}
                          </Button>
                        </CollapsibleTrigger>
                      </Collapsible>
                    ) : (
                      <p dangerouslySetInnerHTML={{ __html: decodeHtml(comment.comment_body) }}></p>
                    )}
                  </div>

                  {comment.ai_summary && (
                    <div className="mb-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleSummary(comment.id)}
                        className="flex items-center gap-1 text-xs"
                      >
                        <Lightbulb className="h-3 w-3" />
                        {showSummaryState[comment.id] ? "Hide AI Summary" : "Show AI Summary"}
                      </Button>
                      {showSummaryState[comment.id] && (
                        <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-md border border-yellow-200 dark:border-yellow-800 animate-in fade-in duration-300">
                          <h5 className="font-medium text-yellow-700 dark:text-yellow-300 text-xs mb-1">AI Summary:</h5>
                          <p className="text-yellow-600 dark:text-yellow-400 text-sm">{comment.ai_summary}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {comment.comment_permalink && (
                    <div className="comment-footer">
                      <a
                        href={comment.comment_permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline text-sm flex items-center gap-1"
                      >
                        View on Reddit <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <MadeWithDyad />
        </CardFooter>
      </Card>
    </div>
  );
};

export default SavedCommentsPage;