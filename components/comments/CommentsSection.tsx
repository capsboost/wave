"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import { useAuthModal } from "@/store/useAuthModal";
import { Send, Reply, User } from "lucide-react";

interface CommentsSectionProps {
  animeId: string;
  episodeNumber: string;
}
interface Comment {
  id: string;
  content: string;
  parentId: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    image?: string;
  };
}

export function CommentsSection({ animeId, episodeNumber }: CommentsSectionProps) {
  const { data: session } = useSession();
  const { openModal } = useAuthModal();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/comments?animeId=${animeId}&episodeNumber=${episodeNumber}`)
      .then(res => res.json())
      .then(data => {
        if (data.comments) setComments(data.comments);
      })
      .finally(() => setLoading(false));
  }, [animeId, episodeNumber]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return openModal('login');
    if (!newComment.trim()) return;

    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ animeId, episodeNumber, content: newComment, parentId: replyingTo })
      });
      const data = await res.json();
      if (data.comment) {
        // optimistically update
        const newCommentObj = {
          ...data.comment,
          user: { id: session.user.id, name: session.user.name, image: session.user.image }
        };
        setComments([newCommentObj, ...comments]);
        setNewComment("");
        setReplyingTo(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const topLevelComments = comments.filter(c => !c.parentId);
  const replies = comments.filter(c => c.parentId);

  return (
    <div className="flex flex-col gap-6 w-full mt-8 lg:mt-0">
      <div className="flex items-center gap-2 border-b border-outline-variant pb-4">
        <h2 className="font-headline-xl text-xl text-on-surface tracking-wider">COMMENTS</h2>
        <span className="bg-neon-crimson text-void-black font-label-caps text-xs px-2 py-0.5 clip-chip font-bold">{comments.length}</span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 relative">
        {replyingTo && (
          <div className="flex items-center justify-between text-xs font-label-caps text-cyber-cyan mb-1 px-2">
            <span>Replying to comment...</span>
            <button type="button" onClick={() => setReplyingTo(null)} className="hover:text-white">Cancel</button>
          </div>
        )}
        <div className="relative">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={session ? "Add a comment..." : "Log in to comment..."}
            className="w-full bg-surface-container border border-outline-variant/50 focus:border-neon-crimson outline-none text-white px-4 py-4 font-body-md clip-corner pr-12 transition-colors"
          />
          <button 
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-neon-crimson hover:bg-neon-crimson/10 transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>

      <div className="flex flex-col gap-4 mt-4">
        {loading ? (
          <div className="text-on-surface-variant font-label-caps text-sm animate-pulse">Loading comments...</div>
        ) : topLevelComments.length === 0 ? (
          <div className="text-on-surface-variant font-label-caps text-sm">No comments found. Be the first.</div>
        ) : (
          topLevelComments.map(comment => (
            <div key={comment.id} className="flex flex-col gap-2 bg-surface-container/30 p-4 border border-outline-variant/30 clip-corner">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-cyber-cyan text-void-black flex items-center justify-center font-headline-md uppercase clip-chip">
                  {comment.user?.name?.charAt(0) || <User className="w-4 h-4" />}
                </div>
                <div>
                  <p className="font-headline-md text-sm text-on-surface">{comment.user?.name || "Unknown"}</p>
                  <p className="font-label-caps text-xs text-on-surface-variant">
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <p className="text-on-surface-variant text-sm mt-1">{comment.content}</p>
              
              <div className="flex items-center gap-4 mt-2">
                <button 
                  onClick={() => setReplyingTo(comment.id)}
                  className="flex items-center gap-1 text-xs font-label-caps text-on-surface-variant hover:text-cyber-cyan transition-colors"
                >
                  <Reply className="w-3 h-3" /> REPLY
                </button>
              </div>

              {/* Nested Replies */}
              {replies.filter(r => r.parentId === comment.id).map(reply => (
                <div key={reply.id} className="ml-8 mt-3 flex flex-col gap-2 border-l border-outline-variant/30 pl-4">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-neon-crimson text-void-black flex items-center justify-center font-headline-md text-xs uppercase clip-chip">
                      {reply.user?.name?.charAt(0) || <User className="w-3 h-3" />}
                    </div>
                    <div>
                      <p className="font-headline-md text-xs text-on-surface">{reply.user?.name || "Unknown"}</p>
                    </div>
                  </div>
                  <p className="text-on-surface-variant text-xs mt-1">{reply.content}</p>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
