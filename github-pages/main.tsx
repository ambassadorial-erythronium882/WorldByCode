import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "../app/globals.css";

const Home = lazy(() => import("../app/page"));
const WorldStudio = lazy(() =>
  import("../app/WorldStudio").then((module) => ({
    default: module.WorldStudio,
  })),
);

const normalizedPath = window.location.pathname.replace(/\/+$/, "");
const isDemo = normalizedPath.endsWith("/demo");

document.title = isDemo
  ? "Live demo · WorldByCode"
  : "Photo in. World out. · WorldByCode";
document.documentElement.style.setProperty(
  "--font-geist-sans",
  '"Arial", sans-serif',
);
document.documentElement.style.setProperty(
  "--font-geist-mono",
  '"SFMono-Regular", Consolas, monospace',
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            background: "#f3f1e9",
            color: "#171711",
            fontFamily: "monospace",
          }}
        >
          Loading WorldByCode…
        </div>
      }
    >
      {isDemo ? <WorldStudio /> : <Home />}
    </Suspense>
  </StrictMode>,
);
