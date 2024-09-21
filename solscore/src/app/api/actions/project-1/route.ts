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

const headers = createActionHeaders({
  chainId: "devnet", // or chainId: "devnet"
  actionVersion: "2.2.1", // the desired spec version
});

const REVIEW_PROGRAM_ID = new PublicKey('HahXGYW8GUUJSvnYRgj7LaHuvLcUhhz71tbRgX6aDPuE');
const PROJECT_PUBLIC_KEY = new PublicKey('FeV4wbe9PTyQZZJhPbKf1qvMZTJZe4QLqPBR4HbtNLBS');

// GET handler for the Action API (this is used for defining the input form)
export const GET = async () => {
  const payload: ActionGetResponse = {
    title: 'Submit Review for Project 1',
    icon: 'https://ucarecdn.com/d08d3b6b-e068-4d78-b02f-30d91c1fb74c/examplemandahansen.jpg', // Replace with a valid image URL
    description: 'Submit a review for Project 1',
    label: 'Submit Review',
    links: {
      actions: [
        {
          href: '/api/actions/project-1',
          label: 'Submit Review',
          parameters: [
            {
              type: 'number',
              name: 'rating',
              label: 'Rating (1-5)',
              required: true,
              min: 1,
              max: 5,
            },
            {
              type: 'textarea',
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
    // Get account from ActionPostRequest (the POST request body)
    const body: ActionPostRequest = await req.json();
    const account = body.account;

    if (!account) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: account' }),
        { status: 400, headers },
      );
    }

    // Now get rating and reviewText from the URL
    const requestUrl = new URL(req.url);
    const ratingParam = requestUrl.searchParams.get('rating');
    const reviewTextParam = requestUrl.searchParams.get('reviewText');

    if (!ratingParam || !reviewTextParam) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: rating or reviewText' }),
        { status: 400, headers },
      );
    }

    const rating = parseInt(ratingParam);
    const reviewText = reviewTextParam;

    if (isNaN(rating) || rating < 1 || rating > 5) {
      return new Response(
        JSON.stringify({ error: 'Invalid "rating" provided' }),
        { status: 400, headers },
      );
    }

    // Validate account
    let accountPubkey: PublicKey;
    try {
      accountPubkey = new PublicKey(account);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid "account" provided' }),
        { status: 400, headers },
      );
    }

    // Create a connection to the Solana cluster (devnet or mainnet)
    const connection = new Connection(
      process.env.SOLANA_RPC! || clusterApiUrl('devnet'),
    );

    // Fetch the recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    // Create a transaction instruction for the review program
    const instruction = new TransactionInstruction({
      programId: REVIEW_PROGRAM_ID,
      keys: [
        { pubkey: accountPubkey, isSigner: true, isWritable: true },
        { pubkey: PROJECT_PUBLIC_KEY, isSigner: false, isWritable: false },
      ],
      data: Buffer.from(JSON.stringify({ rating, reviewText }), 'utf8'),
    });

    // Create the transaction and add the instruction
    const transaction = new Transaction({
      feePayer: accountPubkey,
      blockhash,
      lastValidBlockHeight,
    }).add(instruction);

    // Check that the transaction is constructed correctly
    if (!transaction.instructions || transaction.instructions.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Transaction has no instructions' }),
        { status: 400, headers },
      );
    }

    // Use createPostResponse to return a Blinks-compatible response
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
    console.error('Error in POST:', err);
    return new Response(
      JSON.stringify({ error: 'An error occurred during processing' }),
      { status: 400, headers },
    );
  }
};
