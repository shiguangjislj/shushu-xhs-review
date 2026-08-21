import ShushuApp from "./shushu-app";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/context";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (!await getCurrentUser()) redirect("/login?return_to=%2F");
  return <ShushuApp />;
}
