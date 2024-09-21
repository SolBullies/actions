import {
  // ActionPostResponse,
  // createPostResponse,
  ActionGetResponse,
  ActionPostRequest,
  createActionHeaders,
} from '@solana/actions';
// import {
//   clusterApiUrl,
//   Connection,
//   PublicKey,
//   Transaction,
//   TransactionInstruction,
// } from '@solana/web3.js';

// Create the standard headers for this route (including CORS)
const headers = createActionHeaders();

// Project-specific configuration (replace with your project's public key)
// const PROJECT_PUBLIC_KEY = new PublicKey('FeV4wbe9PTyQZZJhPbKf1qvMZTJZe4QLqPBR4HbtNLBS'); // Replace with the actual project public key
// const REVIEW_PROGRAM_ID = new PublicKey('HahXGYW8GUUJSvnYRgj7LaHuvLcUhhz71tbRgX6aDPuE'); // Replace with your review smart contract program ID

// GET handler for the Action API (this is used for defining the input form)
export const GET = async () => {
  const payload: ActionGetResponse = {
    title: 'Submit Review for Project',
    icon: 'https://link-to-image.com/project_icon.jpg', // Replace with a valid image URL
    description: 'Submit a review for the specified project on-chain',
    label: 'Submit Review',
    links: {
      actions: [
        {
          href: '/api/submit_review',
          label: 'Submit Review',
          parameters: [
            {
              type: 'number', // Number input for ratings
              name: 'rating',
              label: 'Rating (1-5)',
              required: true,
              min: 1, // Set minimum rating
              max: 5, // Set maximum rating
            },
            {
              type: 'textarea', // Text area for review
              name: 'reviewText',
              label: 'Write your review',
              required: true,
            },
          ],
        },
      ],
    },
  };

  return new Response(JSON.stringify(payload), {
    headers,
  });
};

// Handle OPTIONS request for CORS
export const OPTIONS = async () => {
  return new Response(null, { headers });
};

// POST handler for submitting the review on-chain
export const POST = async (req: Request) => {
  try {
    // Log the raw request body to inspect the structure
    const body: ActionPostRequest = await req.json();
    console.log('Received ActionPostRequest body:', JSON.stringify(body, null, 2));

    // From here, you can explore what the body contains
    // Once we know the structure, we can adjust the rest of the code

    // For now, return a placeholder response
    return new Response('Body logged. Please check the logs.', {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error('Error in POST:', err);
    return new Response('An error occurred', {
      status: 400,
      headers,
    });
  }
};
