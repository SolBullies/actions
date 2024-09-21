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
  Keypair,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from '@solana/web3.js';

const headers = createActionHeaders({
  chainId: "devnet",
  actionVersion: "2.2.1",
});

const REVIEW_PROGRAM_ID = new PublicKey('HahXGYW8GUUJSvnYRgj7LaHuvLcUhhz71tbRgX6aDPuE');
const PROJECT_PUBLIC_KEY = new PublicKey('FeV4wbe9PTyQZZJhPbKf1qvMZTJZe4QLqPBR4HbtNLBS');

export const GET = async () => {
  const payload: ActionGetResponse = {
    title: 'Submit Review for Project',
    icon: 'https://ucarecdn.com/d08d3b6b-e068-4d78-b02f-30d91c1fb74c/examplemandahansen.jpg',
    description: 'Submit a review for the specified project on-chain',
    label: 'Submit Review',
    links: {
      actions: [
        {
          href: '/api/actions/project-1?rating={rating}&reviewText={reviewText}',
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

const ReviewAccountSize = 337; // Define the size of the review account in bytes

export const POST = async (req: Request) => {
  try {
    // Extract the 'url' parameter first
    const requestUrl = new URL(req.url);
    const encodedUrl = requestUrl.searchParams.get('url');

    if (!encodedUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing required URL parameter' }),
        { status: 400, headers }
      );
    }

    // Decode the inner URL
    const innerUrl = new URL(decodeURIComponent(encodedUrl));

    // Extract rating and reviewText from the inner URL
    const ratingParam = innerUrl.searchParams.get('rating');
    const reviewTextParam = innerUrl.searchParams.get('reviewText');

    if (!ratingParam || !reviewTextParam) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: rating or reviewText' }),
        { status: 400, headers }
      );
    }

    const rating = parseInt(ratingParam);
    const reviewText = reviewTextParam;

    if (isNaN(rating) || rating < 1 || rating > 5) {
      return new Response(
        JSON.stringify({ error: 'Invalid "rating" provided' }),
        { status: 400, headers }
      );
    }

    const body: ActionPostRequest = await req.json();
    let accountPubkey: PublicKey;
    try {
      accountPubkey = new PublicKey(body.account);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid "account" provided' }),
        { status: 400, headers }
      );
    }

    const connection = new Connection(
      process.env.SOLANA_RPC! || clusterApiUrl('devnet')
    );

    // Generate a new Keypair for the review
    const reviewKeypair = Keypair.generate();

    // Calculate rent exemption for the review account
    const lamports = await connection.getMinimumBalanceForRentExemption(ReviewAccountSize);

    const createAccountInstruction = SystemProgram.createAccount({
      fromPubkey: accountPubkey, // User who is paying for the account creation
      newAccountPubkey: reviewKeypair.publicKey, // New review account
      lamports: lamports, // Rent exemption amount
      space: ReviewAccountSize, // The size of the account in bytes
      programId: REVIEW_PROGRAM_ID, // The program ID that owns this account
    });

    const submitReviewInstruction = new TransactionInstruction({
      keys: [
        { pubkey: reviewKeypair.publicKey, isSigner: false, isWritable: true }, // Review account
        { pubkey: accountPubkey, isSigner: true, isWritable: true }, // User submitting the review
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System Program
      ],
      programId: REVIEW_PROGRAM_ID, // Review program
      data: Buffer.concat([
        PROJECT_PUBLIC_KEY.toBuffer(), // Project ID
        Buffer.from([rating]), // Rating
        Buffer.from(reviewText, 'utf8'), // Review text
      ]),
    });

    // Get latest blockhash and create transaction
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    const transaction = new Transaction({
      feePayer: accountPubkey,
      blockhash,
      lastValidBlockHeight,
    }).add(createAccountInstruction, submitReviewInstruction);

    // Simulate transaction to catch errors before submission
    const simulationResult = await connection.simulateTransaction(transaction);
    if (simulationResult.value.err) {
      console.error("Simulation failed", simulationResult.value.err);
      return new Response(
        JSON.stringify({ error: 'Transaction simulation failed', details: simulationResult.value.err }),
        { status: 400, headers }
      );
    }

    // Create the post response with the transaction data
    const payload: ActionPostResponse = await createPostResponse({
      fields: {
        transaction,
        message: `Submit review for project: ${PROJECT_PUBLIC_KEY.toString()}`,
      },
    });

    return Response.json(payload, { headers });
  } catch (err) {
    console.error('Error in POST:', err);
    return new Response(
      JSON.stringify({ error: 'An error occurred during processing' }),
      { status: 400, headers }
    );
  }
};
