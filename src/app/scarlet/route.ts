import { handleJsonRedirect } from "@/lib/redirect-helper";

export async function GET() {
  return handleJsonRedirect("scarlet");
}
