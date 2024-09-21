import { ACTIONS_CORS_HEADERS, ActionsJson } from "@solana/actions";

// Handle GET request for actions.json
export const GET = async () => {
  const payload: ActionsJson = {
    rules: [
      // Map all root-level routes to an action
      {
        pathPattern: "/*",
        apiPath: "/api/actions/review-solscore",
      },
      // // Fallback rule for idempotent paths
      // {
      //   pathPattern: "/api/actions/**",
      //   apiPath: "/api/actions/**",
      // },
    ],
  };

  return Response.json(payload, {
    headers: ACTIONS_CORS_HEADERS, // Ensure CORS headers for Blinks
  });
};

// Include the OPTIONS method to handle CORS preflight requests
export const OPTIONS = GET;