import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { Avatar } from "./ui";

export function Wordmark() {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="font-serif text-[28px] font-bold tracking-tight text-neutral-950">Medium</span>
      <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-neutral-500 uppercase">
        clone
      </span>
    </span>
  );
}

/** Top bar. `actions` replaces the default right-hand side (used by the editor). */
export function Header({ actions }: { actions?: ReactNode }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menu.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" aria-label="Home">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-3 sm:gap-5">
          {actions ??
            (user ? (
              <>
                <Link to="/write" className="flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-950">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <path d="M14 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9" />
                    <path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  <span className="hidden sm:inline">Write</span>
                </Link>
                <div className="relative" ref={menu}>
                  <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu" className="rounded-full">
                    <Avatar name={user.name} />
                  </button>
                  {open && (
                    <div role="menu" className="absolute right-0 mt-2 w-56 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 text-sm shadow-lg">
                      <div className="border-b border-neutral-100 px-4 py-3">
                        <p className="truncate font-medium text-neutral-900">{user.name}</p>
                        <p className="truncate text-xs text-neutral-500">{user.username}</p>
                      </div>
                      <Link role="menuitem" to="/me/stories" onClick={() => setOpen(false)} className="block px-4 py-2 text-neutral-700 hover:bg-neutral-50">
                        Your stories
                      </Link>
                      <button
                        role="menuitem"
                        type="button"
                        onClick={() => {
                          logout();
                          navigate("/");
                        }}
                        className="block w-full px-4 py-2 text-left text-neutral-700 hover:bg-neutral-50"
                      >
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link to="/signin" className="text-sm text-neutral-600 hover:text-neutral-950">
                  Sign in
                </Link>
                <Link to="/signup" className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
                  Get started
                </Link>
              </>
            ))}
        </div>
      </div>
    </header>
  );
}
