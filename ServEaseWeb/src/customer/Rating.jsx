import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import CustomerSidebar from '../components/CustomerSidebar';
import starFilled from '../assets/icon_star.png';
import starEmpty from '../assets/icon_star_grey.png';
import { rateRequest } from '../api/client';

/* =====================================================================================
   RATE AND REVIEW (customer)
   Route: /customer/requests/:requestId/review
   -------------------------------------------------------------------------------------
   The only data this screen sends is the star rating
   and the review text. The service provider is NOT sent from the browser: the backend
   finds it from the request, so a customer can only rate the provider they actually used.

   BACKEND INTEGRATION (LIVE)
     POST /api/service-requests/:requestId/rating   body: { rating: 1-5, review: string }
     -> 201 { rating } | 409 when the request is not completed yet or already rated.
     The provider's profile stats (average, review count, masked review list) are
     computed from the ratings table by GET /api/service-providers/:id.
   ===================================================================================== */

const MAX_STARS = 5;
const MAX_REVIEW_LENGTH = 500;

// Empty = icon_star_grey.png, selected = icon_star.png. Use a high-resolution version of the
// icons (about 118 x 118 px) if they look soft at 59 x 59.
function Star({ filled }) {
  return (
    <img
      src={filled ? starFilled : starEmpty}
      alt=""
      aria-hidden="true"
      className="block h-[59px] w-[59px] object-contain"
    />
  );
}

export default function Rating() {
  const navigate = useNavigate();
  const { requestId } = useParams();

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // The screen only makes sense for a real request — without one, go back to the list.
  if (!requestId) return <Navigate to="/customer/requests" replace />;

  const shownRating = hoverRating || rating;
  const canSend = rating > 0 && !submitting;

  const handleSend = async () => {
    if (!canSend) return;
    setSubmitting(true);
    setError('');
    try {
      await rateRequest(requestId, { rating, review });
      navigate('/customer/requests?tab=done');
    } catch (err) {
      // 409: not completed yet, or already rated — show the server's reason.
      setError(err.message || 'Could not send your review. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <CustomerSidebar>
      <div className="box-border px-[42px] pb-10 pt-[25px]">
        <h1 className="m-0 flex h-[68px] items-center font-[Quicksand] text-[32px] font-bold leading-[32px] text-[#005FCA] sm:text-[40px] lg:text-[48px]">
          Rate and Review
        </h1>

        <h2 className="m-0 mt-[25px] font-[Inter] text-[20px] font-bold leading-[34px] text-[#292727]">
          Request #{requestId}
        </h2>

        {error && (
          <p role="alert" className="m-0 mt-3 font-[Inter] text-[13px] text-[#B91C1C]">
            {error}
          </p>
        )}

        <div className="mt-[48px] w-full max-w-[642px] lg:ml-[128px]">
          <p className="m-0 pl-1 font-[Roboto] text-[14px] font-semibold leading-[16px] text-[#292727]">
            Rate
          </p>

          <div
            role="radiogroup"
            aria-label="Rating"
            className="mt-[30px] flex justify-center gap-[2px] lg:justify-start lg:pl-[178px]"
            onMouseLeave={() => setHoverRating(0)}
          >
            {Array.from({ length: MAX_STARS }, (_, i) => i + 1).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={rating === value}
                aria-label={`${value} star${value > 1 ? 's' : ''}`}
                onClick={() => setRating(value)}
                onMouseEnter={() => setHoverRating(value)}
                onFocus={() => setHoverRating(value)}
                onBlur={() => setHoverRating(0)}
                className="cursor-pointer rounded-[4px] border-none bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0255AF]"
              >
                <Star filled={value <= shownRating} />
              </button>
            ))}
          </div>

          <label
            htmlFor="review-text"
            className="mt-[37px] block pl-1 font-[Roboto] text-[14px] font-semibold leading-[16px] text-[#292727]"
          >
            Review
          </label>

          <textarea
            id="review-text"
            value={review}
            onChange={(e) => setReview(e.target.value)}
            maxLength={MAX_REVIEW_LENGTH}
            placeholder="Enter your review and sentiments here."
            className="mt-[32px] box-border block h-[131px] w-full resize-none rounded-[10px] border border-[#818080] bg-white px-[21px] py-[19px] font-[Inter] text-[12px] leading-[14px] text-[#333333] outline-none placeholder:text-[#333333] focus:border-[#0255AF]"
          />

          <div className="mt-[34px] flex justify-end pr-[11px]">
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              className="h-[27px] w-[82px] cursor-pointer rounded-[10px] border border-[#B1A8A8] bg-[#FFFDFD] font-[Inter] text-[10px] font-bold leading-[17px] text-[#414141] hover:bg-[#F3F3F3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0255AF] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[#FFFDFD]"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </CustomerSidebar>
  );
}
