import ShushuApp from "./shushu-app";
import { redirect } from "next/navigation";
import { chatGPTSignInPath } from "./chatgpt-auth";
import { getCurrentUser } from "@/lib/context";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (!await getCurrentUser()) redirect(chatGPTSignInPath("/"));
  return <ShushuApp />;
}
