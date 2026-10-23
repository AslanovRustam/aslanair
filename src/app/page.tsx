import { preload } from "react-dom";
import Loader from "@/ui/Loader";
import ClientRoot from "./ClientRoot";

export default function Home() {
  // the plane picture is the first thing the loader shows, and the hero keeps it
  preload("/images/plane-hero.png", { as: "image", fetchPriority: "high" });
  return (
    <>
      <Loader />
      <ClientRoot />
    </>
  );
}
