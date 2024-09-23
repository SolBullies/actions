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
} from '@solana/web3.js';

const headers = createActionHeaders({
  chainId: "devnet",
  actionVersion: "2.2.1",
});

const REVIEW_PROGRAM_ID = new PublicKey(
  'H8UL9huVgs3Ez3CRKJh771gtbTHEu633dhFfKc8aCvFr'
);
const PROJECT_PUBLIC_KEY = new PublicKey(
  'C8LjSYdNaj4txJLpHEdu6S7B42kZAejWNZ5ULeQzQCco'
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
    const baseHref = new URL(`/api/actions/project-1`, requestUrl.origin).toString();

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

    return Response.json(payload, { headers });
  } catch (err) {
    console.log(err);
    const message = typeof err === 'string' ? err : 'An unknown error occurred';
    return new Response(message, { status: 400, headers });
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

    const connection = new Connection(clusterApiUrl('devnet'));

    // Derive the PDA for the review account based on the seeds used in the smart contract
    const [reviewPDA] = await PublicKey.findProgramAddress(
      [Buffer.from('review'), PROJECT_PUBLIC_KEY.toBuffer(), accountPubkey.toBuffer()],
      REVIEW_PROGRAM_ID
    );

    // Calculate rent exemption for the review account
    const lamports = await connection.getMinimumBalanceForRentExemption(128);

    // Fetch the latest blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    // Create the transaction
    const transaction = new Transaction({
      feePayer: accountPubkey, // The fee payer is the user's public key
      blockhash,
      lastValidBlockHeight,
    });

    // Add instructions to create the account (PDA) and submit the review
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: accountPubkey,
        newAccountPubkey: reviewPDA,
        lamports,
        space: 128,
        programId: REVIEW_PROGRAM_ID,
      })
    );

    transaction.add(
      new TransactionInstruction({
        keys: [
          { pubkey: reviewPDA, isSigner: false, isWritable: true }, // Review PDA does not need to be a signer
          { pubkey: accountPubkey, isSigner: true, isWritable: true }, // User's account must be a signer
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: REVIEW_PROGRAM_ID,
        data: Buffer.concat([
          PROJECT_PUBLIC_KEY.toBuffer(),
          Buffer.from([rating]),
          Buffer.from(reviewText, 'utf8'),
        ]),
      })
    );

    console.log("Transaction prepared:", transaction);

    // Create the post response with the prepared transaction data for Blink to handle signing
    const postResponse: ActionPostResponse = await createPostResponse({
      fields: {
        transaction, // Pass the Transaction object to Blink for signing
        message: `Submit review for project: ${PROJECT_PUBLIC_KEY.toString()}`,
      },
    });

    return Response.json(postResponse, { headers });
  } catch (err) {
    console.error('Error in POST:', err);

    return new Response(
      JSON.stringify({
        error: `An error occurred during processing: ${
          err instanceof Error ? err.message : String(err)
        }`,
      }),
      { status: 400, headers }
    );
  }
};
