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

const headers = createActionHeaders({
  chainId: "devnet", // Ensure the correct chain is set
  actionVersion: "2.2.1", // Set the correct action version
});

const REVIEW_PROGRAM_ID = new PublicKey('3avu7LSQhwJeZywCPwFcFMWtFJuHHumYQnWGWMLMWH3B');

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

    return new Response(JSON.stringify(payload), {
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // Enable CORS
      },
    });
  } catch (err) {
    console.log(err);
    const message = typeof err === 'string' ? err : 'An unknown error occurred';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // Enable CORS
      },
    });
  }
};

// Handle OPTIONS request for CORS
export const OPTIONS = async () => {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*', // Allows all origins
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', // Allowed methods
      'Access-Control-Allow-Headers': 'Content-Type, X-Action-Version, X-Blockchain-Ids', // Allowed headers
    },
  });
};

// POST handler with Anchor program interaction
export const POST = async (req: Request) => {
  try {
    // Parse the request body
    const body: ActionPostRequest = await req.json();
    const account = new PublicKey(body.account); // User's public key from the ActionPostRequest

    const requestUrl = new URL(req.url);
    const { rating, reviewText } = validatedQueryParams(requestUrl);

    // Set up Solana connection and provider
    const connection = new Connection(clusterApiUrl('devnet'));
    const provider = new anchor.AnchorProvider(connection, { publicKey: account } as anchor.Wallet, {});

    anchor.setProvider(provider);

    // Load the program using the IDL and the program ID
    const idl = await anchor.Program.fetchIdl(REVIEW_PROGRAM_ID, provider);
    if (!idl) {
      throw new Error('IDL not found');
    }
    const program = new anchor.Program(idl, provider);

    // Generate a new keypair for the review account
    const reviewKeypair = anchor.web3.Keypair.generate();

    // Create the transaction instruction to submit the review
    const instruction = await program.methods
      .submitReview('BBb3Nagqg7iMuuZq3BM3yYUNURPcUSm7TGPLg5dVosyL', rating, reviewText) // Pass project public key as input, not an account
      .accounts({
        review: reviewKeypair.publicKey,
        user: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([reviewKeypair])
      .instruction(); // Await the instruction

    // Create the transaction and add the awaited instruction
    const transaction = new Transaction().add(instruction);

    // Prepare the response payload with the serialized transaction
    const payload: ActionPostResponse = await createPostResponse({
      fields: {
        transaction,
        message: "Submit this transaction to complete your review submission.",
      },
    });

    return new Response(JSON.stringify(payload), {
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // Enable CORS
      },
    });
  } catch (err) {
    console.error('An error occurred:', err);

    // Return a proper JSON error response
    return new Response(
      JSON.stringify({
        error: typeof err === 'string' ? err : 'An unknown error occurred',
      }),
      {
        status: 400,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*', // Enable CORS
        },
      }
    );
  }
};
