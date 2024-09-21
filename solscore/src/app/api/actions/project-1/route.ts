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

    const ReviewAccountSize = 8 + 32 + 32 + 1 + 8 + 256; // Total space for the account

    // Calculate rent exemption for the review account
    const lamports = await connection.getMinimumBalanceForRentExemption(ReviewAccountSize);

    // Create an account for the review
    const createAccountInstruction = SystemProgram.createAccount({
      fromPubkey: accountPubkey, // User who is paying for the account creation
      newAccountPubkey: reviewKeypair.publicKey, // New review account
      lamports: lamports, // Rent exemption amount
      space: ReviewAccountSize, // The size of the account in bytes
      programId: REVIEW_PROGRAM_ID, // The program ID that owns this account
    });

    // Submit the review (mirroring your Anchor test)
    const submitReviewInstruction = new TransactionInstruction({
      keys: [
        { pubkey: reviewKeypair.publicKey, isSigner: true, isWritable: true }, // Review account
        { pubkey: accountPubkey, isSigner: true, isWritable: true }, // User submitting the review
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System Program
      ],
      programId: REVIEW_PROGRAM_ID, // The program ID of your smart contract
      data: Buffer.concat([
        PROJECT_PUBLIC_KEY.toBuffer(), // Project ID (public key)
        Buffer.from([rating]), // Rating (u8)
        Buffer.from(reviewText, 'utf8') // Review text as a string
      ]),
    });

    // Get latest blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    // Create transaction with blockhash and feePayer details
    const transaction = new Transaction({
      feePayer: accountPubkey,
      blockhash,
      lastValidBlockHeight,
    }).add(createAccountInstruction, submitReviewInstruction);

    // Add the review keypair as a signer, like in your test
    transaction.sign(reviewKeypair);

    // Create the post response with the transaction data
    const payload: ActionPostResponse = await createPostResponse({
      fields: {
        transaction,
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
