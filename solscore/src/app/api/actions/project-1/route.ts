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

const REVIEW_PROGRAM_ID = new PublicKey(
  'HahXGYW8GUUJSvnYRgj7LaHuvLcUhhz71tbRgX6aDPuE'
);
const PROJECT_PUBLIC_KEY = new PublicKey(
  'FeV4wbe9PTyQZZJhPbKf1qvMZTJZe4QLqPBR4HbtNLBS'
);

function validatedQueryParams(requestUrl: URL) {
  const rating = requestUrl.searchParams.get('rating');
  const reviewText = requestUrl.searchParams.get('reviewText');

  if (!rating || !reviewText) {
    throw new Error('Missing required parameters: rating or reviewText');
  }

  return {
    rating: parseInt(rating, 10),
    reviewText,
  };
}

// GET request for generating the URL
export const GET = async (req: Request) => {
  try {
    const requestUrl = new URL(req.url);
    const baseHref = new URL(
      `/api/actions/project-1`,
      requestUrl.origin
    ).toString();

    const payload: ActionGetResponse = {
      type: 'action',
      title: 'Submit Review for Project',
      icon: 'https://ucarecdn.com/d08d3b6b-e068-4d78-b02f-30d91c1fb74c/examplemandahansen.jpg',
      description: 'Submit a review for the specified project on-chain',
      label: 'Submit Review',
      links: {
        actions: [
          {
            label: 'Submit Review',
            href: `${baseHref}?rating={rating}&reviewText={reviewText}`,
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

    return Response.json(payload, {
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

// Handle OPTIONS request for CORS
export const OPTIONS = async () => {
  return new Response(null, { headers });
};

// POST handler with proper Transaction object
export const POST = async (req: Request) => {
  try {
    const body: ActionPostRequest = await req.json();
    const account = body.account;

    const requestUrl = new URL(req.url);
    const { rating, reviewText } = validatedQueryParams(requestUrl);

    if (isNaN(rating) || rating < 1 || rating > 5) {
      return new Response(
        JSON.stringify({ error: 'Invalid "rating" provided' }),
        { status: 400, headers }
      );
    }

    let accountPubkey: PublicKey;
    try {
      accountPubkey = new PublicKey(account);
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
    const lamports = await connection.getMinimumBalanceForRentExemption(128);

    const createAccountInstruction = SystemProgram.createAccount({
      fromPubkey: accountPubkey,
      newAccountPubkey: reviewKeypair.publicKey,
      lamports,
      space: 128,
      programId: REVIEW_PROGRAM_ID,
    });

    const submitReviewInstruction = new TransactionInstruction({
      keys: [
        { pubkey: reviewKeypair.publicKey, isSigner: false, isWritable: true },
        { pubkey: accountPubkey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: REVIEW_PROGRAM_ID,
      data: Buffer.concat([
        PROJECT_PUBLIC_KEY.toBuffer(),
        Buffer.from([rating]),
        Buffer.from(reviewText, 'utf8'),
      ]),
    });

    // Get latest blockhash and last valid block height
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    // Create transaction
    const transaction = new Transaction({
      feePayer: accountPubkey,
      blockhash,
      lastValidBlockHeight,
    }).add(createAccountInstruction, submitReviewInstruction);

    // // Simulate the transaction to check for issues
    // const simulationResult = await connection.simulateTransaction(transaction);
    // console.log(simulationResult);
    // if (simulationResult.value.err) {
    //   console.error("Transaction simulation failed:", simulationResult.value.err);
    //   return new Response(
    //     JSON.stringify({ error: 'Transaction simulation failed' }),
    //     { status: 400, headers }
    //   );
    // }

    // Create the post response with the transaction data
    const payload: ActionPostResponse = await createPostResponse({
      fields: {
        transaction, // Pass the Transaction object directly
        message: `Submit review for project: ${PROJECT_PUBLIC_KEY.toString()}`,
      },
    });

    return Response.json(payload, {
      headers,
    });
  } catch (err) {
    console.error('Error in POST:', err);
    return new Response(
      JSON.stringify({ error: 'An error occurred during processing' }),
      { status: 400, headers }
    );
  }
};
