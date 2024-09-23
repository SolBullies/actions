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

// Create the necessary headers (including CORS)
const headers = createActionHeaders({
  chainId: 'devnet', // Replace with 'mainnet' if needed
  actionVersion: '2.2.1',
});

// Hardcoded project public key and review program ID
const PROJECT_PUBLIC_KEY = new PublicKey('BBb3Nagqg7iMuuZq3BM3yYUNURPcUSm7TGPLg5dVosyL'); // Hardcoded project public key
const REVIEW_PROGRAM_ID = new PublicKey('3avu7LSQhwJeZywCPwFcFMWtFJuHHumYQnWGWMLMWH3B'); // Hardcoded review program ID

// Function to validate query parameters for the review submission
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

// GET method to return the action metadata for submitting reviews
export const GET = async (req: Request) => {
  const requestUrl = new URL(req.url);

  const baseHref = new URL(`/api/actions/project-1`, requestUrl.origin).toString();

  const payload: ActionGetResponse = {
    type: 'action',
    title: 'Submit a Review',
    icon: 'https://ucarecdn.com/d08d3b6b-e068-4d78-b02f-30d91c1fb74c/examplemandahansen.jpg',
    description: 'Submit a review for a test project on Solana',
    label: 'Submit Review',
    links: {
      actions: [
        {
          label: 'Submit Review',
          href: `${baseHref}?rating={rating}&reviewText={reviewText}`,
          parameters: [
            {
              type: 'select',
              name: 'rating',
              label: 'Rating (1-5)',
              required: true,
              options: [
                { label: '1', value: '1' },
                { label: '2', value: '2' },
                { label: '3', value: '3' },
                { label: '4', value: '4' },
                { label: '5', value: '5' },
              ],
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

// OPTIONS method for CORS
export const OPTIONS = async () => {
  return new Response(null, { headers });
};

// POST method to submit the review transaction using web3.js
export const POST = async (req: Request) => {
  const requestUrl = new URL(req.url);
  const { rating, reviewText } = validatedQueryParams(requestUrl);

  // Parse the request body to get the user's wallet public key
  const body: ActionPostRequest = await req.json();
  const account = new PublicKey(body.account);

  // Set up Solana connection
  const connection = new Connection(clusterApiUrl('devnet')); // Change to 'mainnet-beta' if required

  // Generate a new keypair for the review account (which will sign the transaction)
  const reviewKeypair = Keypair.generate();

  // Create the transaction instruction for submitting the review
  const data = Buffer.concat([
    Buffer.from([1]), // Instruction discriminator for "submitReview"
    PROJECT_PUBLIC_KEY.toBuffer(), // Hardcoded project public key as input
    Buffer.from(new Uint8Array(new Uint16Array([rating]).buffer)), // Rating (1 byte)
    Buffer.from(reviewText, 'utf-8'), // Review text
  ]);

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: reviewKeypair.publicKey, isSigner: true, isWritable: true }, // Review account signs the transaction
      { pubkey: account, isSigner: true, isWritable: false }, // User account as the signer
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System program (for security)
    ],
    programId: REVIEW_PROGRAM_ID,
    data: data,
  });

  // Create a new transaction and add the instruction
  const transaction = new Transaction().add(instruction);

  // Fetch the latest blockhash for the transaction
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

  // Set the blockhash and feePayer for the transaction
  transaction.recentBlockhash = blockhash;
  transaction.lastValidBlockHeight = lastValidBlockHeight;
  transaction.feePayer = account;

  // Sign the transaction with the reviewKeypair
  transaction.partialSign(reviewKeypair);

  // Create the response payload with the serialized transaction
  const payload: ActionPostResponse = await createPostResponse({
    fields: {
      transaction,
      message: `Review submitted for project: ${PROJECT_PUBLIC_KEY.toBase58()}`,
    },
  });

  return new Response(JSON.stringify(payload), {
    headers,
  });
};
