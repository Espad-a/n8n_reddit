"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Heart, MessageSquare, RefreshCw, Link as LinkIcon, ArrowUpRight } from "lucide-react"; // Import RefreshCw and LinkIcon, ArrowUpRight
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton for loading state
import { useNavigate } from "react-router-dom"; // Import useNavigate

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

interface PostCardProps {
  post: {
    id: string; // Added for unique identification
    subreddit: string;
    title: string;
    selftext: string;
    url: string;
    aiSummary?: string;
  };
  isLiked: boolean;
  onLikeToggle: (postId: string) => void;
  onFetchComments: (postId: string, subreddit: string) => Promise<CommentsResponse | null>; // Updated prop signature
  className?: string; // Added className prop
  style?: React.CSSProperties; // Added style prop for animation delays
}

const MAX_COMMENTS_FOR_INLINE_DISPLAY = 50; // Define the threshold for inline comments

const PostCard: React.FC<PostCardProps> = ({ post, isLiked, onLikeToggle, onFetchComments, className, style }) => {
  const navigate = useNavigate(); // Initialize useNavigate
  const [isPostContentOpen, setIsPostContentOpen] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [commentsData, setCommentsData] = useState<CommentsResponse | null>(null);

  // Simple function to decode HTML entities for selftext and comment bodies
  const decodeHtml = (html: string) => {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = html;
    return textarea.value;
  };

  const fetchAndSetComments = async () => {
    setIsLoadingComments(true);
    setShowComments(true); // Ensure comments section is open when fetching
    try {
      const fetchedComments = await onFetchComments(post.id, post.subreddit); // Pass subreddit
      setCommentsData(fetchedComments); // Set the entire response
    } catch (error) {
      console.error("Failed to fetch comments:", error);
      setCommentsData(null); // Set to null on error
    } finally {
      setIsLoadingComments(false);
    }
  };

  const handleShowCommentsClick = async () => {
    if (commentsData && commentsData.combinedSummary.totalComments > MAX_COMMENTS_FOR_INLINE_DISPLAY) {
      // If comments are too large, navigate to the full comments page
      navigate(`/posts/${post.id}/comments`);
    } else if (!commentsData) { // If comments haven't been fetched yet
      await fetchAndSetComments();
    } else {
      // If comments are already fetched and not too large, just toggle visibility
      setShowComments(prev => !prev);
    }
  };

  const handleReloadComments = async () => {
    setCommentsData(null); // Clear existing comments to force refetch
    await fetchAndSetComments();
  };

  const totalComments = commentsData?.combinedSummary.totalComments || 0;
  const commentsTooLarge = totalComments > MAX_COMMENTS_FOR_INLINE_DISPLAY;

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
            onClick={() => onLikeToggle(post.id)}
            className={cn(
              "ml-4",
              isLiked ? "text-red-500 hover:text-red-600" : "text-gray-400 hover:text-red-500"
            )}
          >
            <Heart fill={isLiked ? "currentColor" : "none"} className="h-5 w-5" />
            <span className="sr-only">{isLiked ? "Unlike post" : "Like post"}</span>
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

        {showComments && !commentsTooLarge && ( // Only show inline comments if not too large
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

                {commentsData.individualThreads.map((thread, threadIndex) => (
                  <div key={threadIndex} className="comment-thread mb-6">
                    {thread.comments.map(comment => (
                      <div
                        key={comment.id}
                        className="comment group" // Added group for hover states
                        style={{ marginLeft: comment.depth * 24 + 'px' }} // Adjusted indentation
                        data-author-initial={comment.author.charAt(0).toUpperCase()}
                      >
                        {/* Comment Header with enhanced styling */}
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
                        
                        {/* Comment Body */}
                        <div className="comment-body text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                          <p dangerouslySetInnerHTML={{ __html: decodeHtml(comment.body) }}></p>
                        </div>
                        
                        {/* Reply indicator for non-top-level comments */}
                        {comment.depth > 0 && (
                          <div className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                            <ArrowUpRight className="h-3 w-3" />
                            Replying to parent comment
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {/* Thread separator */}
                    {threadIndex < commentsData.individualThreads.length - 1 && (
                      <div className="border-t border-gray-200 dark:border-gray-700 my-4"></div>
                    )}
                  </div>
                ))}
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