import {
  ActionPostResponse,
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
const PROJECT_PUBLIC_KEY = new PublicKey('FeV4wbe9PTyQZZJhPbKf1qvMZTJZe4QLqPBR4HbtNLBS'); // Replace with your project's public key

// GET handler (the structure for the form inputs)
export const GET = async () => {
  const payload = {
    title: 'Submit Review for Project',
    icon: 'https://link-to-image.com/project_icon.jpg', // Replace with a valid image URL
    description: 'Submit a review for the specified project on-chain',
    label: 'Submit Review',
    links: {
      actions: [
        {
          href: '/api/project-1',
          label: 'Submit Review',
          parameters: [
            {
              type: 'number', // Rating field (1-5)
              name: 'rating',
              label: 'Rating (1-5)',
              required: true,
              min: 1,
              max: 5,
            },
            {
              type: 'textarea', // Review text field
              name: 'reviewText',
              label: 'Write your review',
              required: true,
            },
          ],
        },
      ],
    },
  };

  return new Response(JSON.stringify(payload), { headers });
};

// Handle OPTIONS for CORS support
export const OPTIONS = async () => {
  return new Response(null, { headers });
};

// POST handler for submitting review on-chain, reading rating/reviewText from query parameters
export const POST = async (req: Request) => {
  try {
    const requestUrl = new URL(req.url);
    const { rating, reviewText, account } = validatedQueryParams(requestUrl); // Fetch from URL query params

    let accountPubkey: PublicKey;
    try {
      accountPubkey = new PublicKey(account);
    } catch {
      return new Response('Invalid "account" provided', { status: 400, headers });
    }

    // Validate rating and reviewText
    if (!rating || !reviewText) {
      return new Response('Both rating and reviewText are required', { status: 400, headers });
    }

    // Solana connection (devnet or mainnet)
    const connection = new Connection(
      process.env.SOLANA_RPC! || clusterApiUrl('devnet'),
    );

    // Create a transaction instruction for the review program
    const instruction = new TransactionInstruction({
      programId: REVIEW_PROGRAM_ID, // Smart contract program ID for handling reviews
      keys: [
        { pubkey: accountPubkey, isSigner: true, isWritable: true }, // The user submitting the review
        { pubkey: PROJECT_PUBLIC_KEY, isSigner: false, isWritable: false }, // The project for the review
      ],
      data: Buffer.from(JSON.stringify({ rating, reviewText }), 'utf8'), // Serialize the review data
    });

    const transaction = new Transaction().add(instruction);
    transaction.feePayer = accountPubkey;
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

    // Create the ActionPostResponse with the transaction
    const payload: ActionPostResponse = {
      transaction: transaction.serialize({ verifySignatures: false }).toString('base64'), // Base64-encoded transaction
      message: `Submit review for project: ${PROJECT_PUBLIC_KEY.toString()}`,
    };

    return new Response(JSON.stringify(payload), { headers });
  } catch (err) {
    console.error('Error in POST:', err);
    return new Response('An error occurred during processing', { status: 400, headers });
  }
};

// Helper function to validate and extract query parameters
function validatedQueryParams(requestUrl: URL) {
  let rating: number = 0;
  let reviewText: string = '';
  let account: string = '';

  try {
    if (requestUrl.searchParams.get('rating')) {
      rating = parseInt(requestUrl.searchParams.get('rating')!);
    }
  } catch {
    throw 'Invalid input query parameter: rating';
  }

  try {
    if (requestUrl.searchParams.get('reviewText')) {
      reviewText = requestUrl.searchParams.get('reviewText')!;
    }
  } catch {
    throw 'Invalid input query parameter: reviewText';
  }

  try {
    if (requestUrl.searchParams.get('account')) {
      account = requestUrl.searchParams.get('account')!;
    }
  } catch {
    throw 'Invalid input query parameter: account';
  }

  return {
    rating,
    reviewText,
    account,
  };
}
