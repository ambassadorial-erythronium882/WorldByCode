import type { Metadata } from "next";
import { WorldStudio } from "../WorldStudio";

export const metadata: Metadata = {
  title: "Live demo",
  description:
    "Upload an image or open a verified example, inspect its WorldSpec, and test the compiled Three.js and Rapier physics world.",
};

export default function DemoPage() {
  return <WorldStudio />;
}
