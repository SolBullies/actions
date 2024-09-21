import {
  ActionGetResponse,
  createActionHeaders,
} from '@solana/actions';

// Create the standard headers for this route (including CORS)
const headers = createActionHeaders({
  chainId: "devnet", // or chainId: "devnet"
  actionVersion: "2.2.1", // the desired spec version
});


// GET handler for the Action API (this is used for defining the input form)
export const GET = async () => {
  const payload: ActionGetResponse = {
    title: 'Submit Review for Project',
    icon: 'https://ucarecdn.com/d08d3b6b-e068-4d78-b02f-30d91c1fb74c/examplemandahansen.jpg', // Replace with a valid image URL
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
    // Read the raw request body as plain text
    const rawBody = await req.text();

    // Check if the request body exists
    if (!rawBody) {
      return new Response('Request body is empty', {
        status: 400,
        headers,
      });
    }

    // Parse the raw body into JSON format
    const body = JSON.parse(rawBody);

    // Log the received request body for debugging purposes
    console.log('Received ActionPostRequest body:', JSON.stringify(body, null, 2));

    // Log the account and any inputs for debugging
    console.log('Account:', body.account);
    console.log('Inputs:', body.inputs);

    // If you want, you can also return the body in the response for easier testing
    return new Response(JSON.stringify({ receivedBody: body }), {
      status: 200,
      headers,
    });

  } catch (err) {
    console.error('Error in POST:', err);
    return new Response('An error occurred during processing', {
      status: 400,
      headers,
    });
  }
};
