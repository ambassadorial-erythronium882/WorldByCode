import type { Metadata } from "next";
import { WorldStudio } from "./WorldStudio";

export const metadata: Metadata = {
  title: "Image to executable physics world",
  description:
    "Reconstruct a reference image as an editable, code-only Three.js and Rapier physics world.",
};

export default function Home() {
  return <WorldStudio />;
}
