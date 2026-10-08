import { BrowserRouter, Link, Route, Routes } from "react-router";
import { AuthProvider } from "./auth/AuthContext";
import { GuestOnly, RequireAuth } from "./auth/RouteGuards";
import { Header } from "./components/Header";
import { EmptyState } from "./components/ui";
import { AuthPage } from "./pages/AuthPage";
import { Editor } from "./pages/Editor";
import { Home } from "./pages/Home";
import { MyStories } from "./pages/MyStories";
import { PostPage } from "./pages/PostPage";

function NotFound() {
  return (
    <>
      <Header />
      <EmptyState title="Page not found">
        <Link to="/" className="font-medium text-neutral-900 underline">
          Back to home
        </Link>
      </EmptyState>
    </>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/blogs" element={<Home />} />
      <Route path="/blog/:id" element={<PostPage />} />
      <Route element={<GuestOnly />}>
        <Route path="/signin" element={<AuthPage mode="signin" />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route path="/write" element={<Editor />} />
        <Route path="/publish" element={<Editor />} />
        <Route path="/edit/:id" element={<Editor />} />
        <Route path="/me/stories" element={<MyStories />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
