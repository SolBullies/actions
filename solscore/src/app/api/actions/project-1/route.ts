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
  SystemProgram,
  Keypair,
} from '@solana/web3.js';

// Create the standard headers for this route (including CORS)
const headers = createActionHeaders({
  chainId: "devnet", // or chainId: "devnet"
  actionVersion: "2.2.1", // the desired spec version
});

const REVIEW_PROGRAM_ID = new PublicKey('HahXGYW8GUUJSvnYRgj7LaHuvLcUhhz71tbRgX6aDPuE');
const PROJECT_PUBLIC_KEY = new PublicKey('FeV4wbe9PTyQZZJhPbKf1qvMZTJZe4QLqPBR4HbtNLBS'); // Replace with the actual project public key

export const GET = async () => {
  const payload: ActionGetResponse = {
    title: 'Submit Review for Project',
    icon: 'https://ucarecdn.com/d08d3b6b-e068-4d78-b02f-30d91c1fb74c/examplemandahansen.jpg', // Replace with a valid image URL
    description: 'Submit a review for the specified project on-chain',
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

export const POST = async (req: Request) => {
  try {
    const body: ActionPostRequest = await req.json();
    const account = body.account;

    // Parse the query params from the request URL
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

    let accountPubkey: PublicKey;
    try {
      accountPubkey = new PublicKey(account);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid "account" provided' }),
        { status: 400, headers },
      );
    }

    const connection = new Connection(
      process.env.SOLANA_RPC! || clusterApiUrl('devnet'),
    );

    // Generate a new Keypair for the review, like in your test
    const reviewKeypair = Keypair.generate();

    // Get the latest blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    const instruction = new TransactionInstruction({
      programId: REVIEW_PROGRAM_ID, // Your review program
      keys: [
        { pubkey: reviewKeypair.publicKey, isSigner: true, isWritable: true }, // The review account
        { pubkey: accountPubkey, isSigner: true, isWritable: true }, // The user submitting the review
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System program
      ],
      data: Buffer.from(JSON.stringify({ rating, reviewText }), 'utf8'),
    });

    const transaction = new Transaction({
      feePayer: accountPubkey,
      blockhash,
      lastValidBlockHeight,
    }).add(instruction);

    // Here, we ensure the transaction is fully signed
    transaction.sign(reviewKeypair);

    // Create the post response with the transaction data
    const payload: ActionPostResponse = await createPostResponse({
      fields: {
        transaction, // Pass the Transaction object directly
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
