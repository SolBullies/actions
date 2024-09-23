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
} from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';

// Create the necessary headers (including CORS)
const headers = createActionHeaders({
  chainId: 'devnet', // Replace with 'mainnet' if needed
  actionVersion: '2.2.1',
});

// Hardcoded project public key and review program ID
const PROJECT_PUBLIC_KEY = new PublicKey('BBb3Nagqg7iMuuZq3BM3yYUNURPcUSm7TGPLg5dVosyL'); // Replace with the actual project public key
const REVIEW_PROGRAM_ID = new PublicKey('3avu7LSQhwJeZywCPwFcFMWtFJuHHumYQnWGWMLMWH3B'); // Hardcoded review program ID

// Function to validate query parameters for the review submission
function validatedQueryParams(requestUrl: URL) {
  const rating = requestUrl.searchParams.get('rating');
  const reviewText = requestUrl.searchParams.get('reviewText');

  if (!rating || !reviewText) {
    throw 'Missing required parameters: rating or reviewText';
  }

  return {
    rating: parseInt(rating, 10),
    reviewText,
  };
}

// GET method to return the action metadata for submitting reviews
export const GET = async (req: Request) => {
  try {
    const requestUrl = new URL(req.url);

    const baseHref = new URL(`/api/actions/project-1`, requestUrl.origin).toString();

    const payload: ActionGetResponse = {
      type: 'action',
      title: 'Submit a Review',
      icon: 'https://ucarecdn.com/7aa46c85-08a4-4bc7-9376-88ec48bb1f43/-/preview/880x864/-/quality/smart/-/format/auto/',
      description: 'Submit a review for a test project on Solana',
      label: 'Submit Review', 
      links: {
        actions: [
          {
            label: 'Submit Review', // Button label
            href: `${baseHref}?rating={rating}&reviewText={reviewText}`, // URL to trigger the action
            parameters: [
              {
                type: 'select',
                name: 'rating',
                label: 'Rating (1-5)', // Placeholder for rating input
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
                label: 'Write your review', // Placeholder for review input
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
  } catch (err) {
    console.log('Error:', err);
    return new Response(
      JSON.stringify({
        error: 'An unknown error occurred',
      }),
      {
        status: 400,
        headers,
      },
    );
  }
};

// OPTIONS method for CORS
export const OPTIONS = async () => {
  return new Response(null, { headers });
};

// POST method to submit the review transaction
export const POST = async (req: Request) => {
  try {
    const requestUrl = new URL(req.url);
    const { rating, reviewText } = validatedQueryParams(requestUrl);

    // Parse the request body to get the user's wallet public key
    const body: ActionPostRequest = await req.json();
    const account = new PublicKey(body.account);

    // Set up Solana connection
    const connection = new Connection(clusterApiUrl('devnet')); // Change to 'mainnet-beta' if required
    const provider = new anchor.AnchorProvider(connection, { publicKey: account } as anchor.Wallet, {});

    anchor.setProvider(provider);

    // Load the program using the IDL and program ID
    const idl = await anchor.Program.fetchIdl(REVIEW_PROGRAM_ID, provider);
    if (!idl) {
      throw new Error('IDL not found');
    }

    const program = new anchor.Program(idl, provider);

    // Generate a new keypair for the review account
    const reviewKeypair = anchor.web3.Keypair.generate();

    // Create the instruction for submitting the review
    const instruction = await program.methods
      .submitReview(PROJECT_PUBLIC_KEY, rating, reviewText) // Hardcoded project public key
      .accounts({
        review: reviewKeypair.publicKey,
        user: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([reviewKeypair])
      .instruction(); // Await the instruction

    // Create a new transaction
    const transaction = new Transaction().add(instruction);

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
  } catch (err) {
    console.log('Error:', err);
    return new Response(
      JSON.stringify({
        error: 'An unknown error occurred',
      }),
      {
        status: 400,
        headers,
      },
    );
  }
};
