import { handleProviderCredentialRequest } from "@/server/provider-credential-handler";

export const runtime = "nodejs";
export const maxDuration = 800;
export const POST = handleProviderCredentialRequest;
