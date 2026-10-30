"use client";

import { useState } from "react";
import { useAuthModal } from "@/store/useAuthModal";
import { signIn, signUp } from "@/lib/auth-client";
import { X, Mail, Lock, User, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function AuthModal() {
  const { isOpen, view, closeModal, setView } = useAuthModal();
  const router = useRouter();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (view === 'login') {
        const { error } = await signIn.email({ email, password });
        if (error) throw new Error(error.message || "Failed to login");
        
        closeModal();
        router.refresh();
      } else if (view === 'register') {
        const { error } = await signUp.email({ email, password, name });
        if (error) throw new Error(error.message || "Failed to register");
        
        closeModal();
        router.refresh();
      } else if (view === 'forgot_password') {
        // Implement forgot password later if we setup email transport
        setError("Forgot password email transport not fully configured yet.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-void-black/80 backdrop-blur-sm p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        className="relative w-full max-w-md bg-surface-container border border-outline-variant/30 clip-corner shadow-[0_10px_40px_rgba(255,0,60,0.15)] animate-in fade-in zoom-in duration-200"
      >
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-outline-variant/20">
          <h2 id="auth-modal-title" className="font-headline-lg text-2xl text-on-surface uppercase tracking-wider">
            {view === 'login' ? 'Login' : view === 'register' ? 'Register' : 'Reset Password'}
          </h2>
          <button 
            type="button"
            onClick={closeModal}
            aria-label="Close authentication dialog"
            className="text-on-surface-variant hover:text-neon-crimson transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {error && (
            <div role="alert" className="bg-neon-crimson/10 border border-neon-crimson text-neon-crimson p-3 text-sm font-label-caps mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {view === 'register' && (
              <div className="space-y-1">
                <label htmlFor="auth-name" className="text-xs font-label-caps text-on-surface-variant uppercase">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                  <input 
                    id="auth-name"
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full bg-void-black border border-outline-variant/50 focus:border-neon-crimson outline-none text-white px-10 py-3 font-body-md transition-colors"
                    placeholder="CyberNinja99"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="auth-email" className="text-xs font-label-caps text-on-surface-variant uppercase">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                <input 
                  id="auth-email"
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-void-black border border-outline-variant/50 focus:border-neon-crimson outline-none text-white px-10 py-3 font-body-md transition-colors"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            {view !== 'forgot_password' && (
              <div className="space-y-1">
                <label htmlFor="auth-password" className="text-xs font-label-caps text-on-surface-variant uppercase">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                  <input 
                    id="auth-password"
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-void-black border border-outline-variant/50 focus:border-neon-crimson outline-none text-white px-10 py-3 font-body-md transition-colors"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-neon-crimson hover:bg-white text-void-black hover:text-void-black font-headline-md uppercase py-3 px-4 transition-colors flex justify-center items-center gap-2 mt-6"
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              {view === 'login' ? 'Log In' : view === 'register' ? 'Register' : 'Send Reset Link'}
            </button>
          </form>

          {/* Footer Links */}
          <div className="mt-6 pt-6 border-t border-outline-variant/20 flex flex-col items-center gap-3 text-sm font-label-caps text-on-surface-variant">
            {view === 'login' ? (
              <>
                <button type="button" onClick={() => setView('forgot_password')} className="hover:text-cyber-cyan transition-colors">
                  Forgot Password?
                </button>
                <button type="button" onClick={() => setView('register')} className="hover:text-cyber-cyan transition-colors">
                  New user? Register here
                </button>
              </>
            ) : view === 'register' ? (
              <button type="button" onClick={() => setView('login')} className="hover:text-cyber-cyan transition-colors">
                Already have an account? Login
              </button>
            ) : (
              <button type="button" onClick={() => setView('login')} className="hover:text-cyber-cyan transition-colors">
                Back to Login
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
