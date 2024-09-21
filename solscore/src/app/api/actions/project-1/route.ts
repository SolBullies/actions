import {
  ActionPostResponse,
  createPostResponse,
  ActionGetResponse,
  ActionPostRequest,
  createActionHeaders,
} from '@solana/actions';
import {
  clusterApiUrl,
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';

// create the standard headers for this route (including CORS)
const headers = createActionHeaders();

// Project-specific configuration (replace with your project's public key)
const PROJECT_PUBLIC_KEY = new PublicKey('FeV4wbe9PTyQZZJhPbKf1qvMZTJZe4QLqPBR4HbtNLBS'); // Replace with the actual project public key
const REVIEW_PROGRAM_ID = new PublicKey('HahXGYW8GUUJSvnYRgj7LaHuvLcUhhz71tbRgX6aDPuE'); // Replace with your review smart contract program ID

// GET handler for the Action API (this is used for defining the input form)
export const GET = async (req: Request) => {
  const payload: ActionGetResponse = {
    title: 'Submit Review for Project',
    icon: 'https://ucarecdn.com/d08d3b6b-e068-4d78-b02f-30d91c1fb74c/examplemandahansen.jpg',
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
    const body: ActionPostRequest = await req.json();

    let account: PublicKey;
    try {
      account = new PublicKey(body.account);
    } catch (err) {
      return new Response('Invalid "account" provided', {
        status: 400,
        headers,
      });
    }

    // Retrieve the submitted parameters from the user
    const { rating, reviewText } = body.parameters || {};
    if (!rating || !reviewText) {
      return new Response('Both rating and reviewText are required', {
        status: 400,
        headers,
      });
    }

    // Create a connection to the Solana cluster (devnet by default)
    const connection = new Connection(
      process.env.SOLANA_RPC! || clusterApiUrl('devnet'),
    );

    // Create a transaction instruction for submitting the review to the on-chain program
    const instruction = new TransactionInstruction({
      programId: REVIEW_PROGRAM_ID, // Smart contract program ID for handling reviews
      keys: [
        { pubkey: account, isSigner: true, isWritable: true }, // The user submitting the review
        { pubkey: PROJECT_PUBLIC_KEY, isSigner: false, isWritable: false }, // The project to which the review relates
      ],
      data: Buffer.from(JSON.stringify({ rating, reviewText }), 'utf8'), // Serialize the review data
    });

    const transaction = new Transaction().add(instruction);

    // Set the end user as the fee payer
    transaction.feePayer = account;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    // Create the action post response
    const payload: ActionPostResponse = await createPostResponse({
      fields: {
        transaction,
        message: `Submit review for project: ${PROJECT_PUBLIC_KEY.toString()}`,
      },
    });

    return new Response(JSON.stringify(payload), {
      headers,
    });
  } catch (err) {
    console.log(err);
    let message = 'An unknown error occurred';
    if (typeof err == 'string') message = err;
    return new Response(message, {
      status: 400,
      headers,
    });
  }
};
