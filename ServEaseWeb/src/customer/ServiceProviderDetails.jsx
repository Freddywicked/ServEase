import { useNavigate, useParams } from 'react-router-dom';
import CustomerSidebar from '../components/CustomerSidebar.jsx';
import starIcon from '../assets/icon_star.png';

// ── HARD-CODED CONTENT: START ─────────────────────────────────────────────
// Expected shape of the provider details once the backend is wired up (adjust to the real contract):
//   {
//     id: string | number,
//     name: string,
//     title: string,                  // e.g. 'Automotive Repair Service Provider'
//     avatarUrl: string | null,
//     verified: boolean,
//     available: boolean,
//     yearsExperience: number,
//     specialities: string,
//     location: string,               // may include distance computed server-side
//     availability: string,           // e.g. 'Mon-Fri, 8AM-6PM'
//     positiveFeedbackPercent: number,
//     aiSummaryTags: string[],        // AI Summary Insights chips
//     rating: number,
//     reviewCount: number,
//     reviews: [{ id, reviewerName (already masked), rating, serviceAvailed, comment }],
//   }
const MOCK_PROVIDER = {
  id: 1,
  name: 'Sylvia Lee',
  title: 'Automotive Repair Service Provider',
  avatarUrl: null,
  verified: true,
  available: true,
  yearsExperience: 5,
  specialities: 'IT and Phone Repair',
  location: 'Naga City · 2.5 km away',
  availability: 'Mon-Fri, 8AM-6PM',
  positiveFeedbackPercent: 92,
  aiSummaryTags: ['Professional', 'Always on Time'],
  rating: 4.8,
  reviewCount: 95,
  reviews: [
    {
      id: 1,
      reviewerName: 'N**** O*ea',
      rating: 5,
      serviceAvailed: 'Engine Repair',
      comment: 'The technician was on time. They did a great job at providing their service.',
    },
    {
      id: 2,
      reviewerName: 'N**** O*ea',
      rating: 5,
      serviceAvailed: 'Engine Repair',
      comment: 'The technician was on time. They did a great job at providing their service.',
    },
  ],
};
// ── HARD-CODED CONTENT: END ───────────────────────────────────────────────

function CheckBadgeIcon({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <circle cx="12" cy="12" r="12" fill="#0255AF" />
      <path d="M6.8 12.6l3.5 3.5 6.9-7.4" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ServiceProviderDetails() {
  const navigate = useNavigate();

  // The provider id comes from the route set up by FindServiceProvider.jsx, e.g.
  // <Route path="/customer/providers/:providerId" element={<ServiceProviderDetails />} />
  const { providerId } = useParams();

  // TODO (backend-ready): replace MOCK_PROVIDER with data fetched from the database, e.g.
  //
  //   // const [provider, setProvider] = useState(null);
  //   // const [status, setStatus] = useState('loading'); // 'loading' | 'done' | 'error'
  //   //
  //   // useEffect(() => {
  //   //   let cancelled = false;
  //   //   async function loadProvider() {
  //   //     try {
  //   //       const result = await api.getServiceProvider(providerId); // includes reviews + AI summary
  //   //       if (!cancelled) { setProvider(result); setStatus('done'); }
  //   //     } catch (err) {
  //   //       if (!cancelled) setStatus('error');   // e.g. show a "provider not found" state
  //   //     }
  //   //   }
  //   //   loadProvider();
  //   //   return () => { cancelled = true; };
  //   // }, [providerId]);
  //
  // The AI Summary Insights tags should come from the backend (generated from the reviews),
  // and reviewer names should be masked server-side.
  const provider = MOCK_PROVIDER;

  const handleMessage = () => {
    // TODO (backend-ready): open or create a conversation with this provider, e.g.
    // const conversation = await api.startConversation(providerId);
    // navigate(`/customer/messages/${conversation.id}`);
    navigate('/customer/messages');
  };

  const handleChoose = () => {
    // TODO (backend-ready): attach the chosen provider to the current service request and
    // submit it, e.g.
    // await api.submitServiceRequest({ requestId, providerIds: [providerId], diagnosis }); // requestId/diagnosis from route state or context
    // Route: confirmation screen (SubmitServiceRequest.jsx) — adjust if the route name differs.
    navigate('/customer/request-submitted');
  };

  return (
    <CustomerSidebar>
      <div className="box-border flex flex-col items-center px-4 pb-10 pt-[22px] font-[SF_Pro,system-ui,sans-serif] text-[#484040] sm:px-9">
        {provider.avatarUrl ? (
          <img
            src={provider.avatarUrl}
            alt={provider.name}
            className="h-[144px] w-[144px] rounded-full object-cover"
          />
        ) : (
          <div className="h-[144px] w-[144px] rounded-full bg-[#D9D9D9]" />
        )}

        <h1 className="m-0 mt-[22px] text-center text-[16px] font-bold leading-[19px]">{provider.name}</h1>
        <p className="m-0 mt-[13px] text-center text-[12px] leading-[14px]">{provider.title}</p>

        <div className="mt-[17px] flex flex-wrap items-center justify-center gap-3 text-[12px] leading-[14px]">
          {provider.verified && (
            <span className="relative flex h-[32px] w-[131px] items-center justify-center rounded-[52px] bg-[rgba(87,127,187,0.46)] text-[#0255AF]">
              <span className="absolute left-[15px] top-[7px]">
                <CheckBadgeIcon />
              </span>
              Verified
            </span>
          )}
          {provider.available && (
            <span className="flex h-[32px] w-[123px] items-center justify-center rounded-[29px] bg-[#86FF8A] text-[#167713]">
              Available
            </span>
          )}
          <button
            type="button"
            onClick={handleMessage}
            className="w-[83px] cursor-pointer border-0 bg-transparent p-0 text-center font-[SF_Pro,system-ui,sans-serif] text-[12px] font-bold leading-[14px] text-[#18315B]"
          >
            Message
          </button>
        </div>

        <p className="m-0 mt-[17px] text-center text-[15px] leading-[18px]">
          {provider.yearsExperience} years experience
        </p>

        <div className="mt-[9px] text-center text-[14px] leading-[17px]">
          <p className="m-0">
            <span className="font-bold">Specialities:</span> {provider.specialities}
          </p>
          <p className="m-0">
            <span className="font-bold">Location:</span> {provider.location}
          </p>
          <p className="m-0">
            <span className="font-bold">Available:</span> {provider.availability}
          </p>
        </div>

        <p className="m-0 mt-[15px] text-center text-[12px] font-bold leading-[14px]">
          {provider.positiveFeedbackPercent}% Positive Feedback
        </p>

        <div className="mt-[26px] flex w-full max-w-[350px] flex-col">
          <p className="m-0 pl-[7px] text-[12px] font-bold leading-[14px]">AI Summary Insights</p>

          <div className="mt-2 flex gap-1 pl-[6px]">
            {provider.aiSummaryTags.map((tag) => (
              <span
                key={tag}
                className="box-border flex h-[21px] w-[98px] items-center justify-center rounded-[10px] border border-[#818080] bg-white text-[9px] leading-[11px]"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="mt-[15px] flex items-center pl-1 text-[12px] leading-[14px]">
            <img src={starIcon} alt="" className="h-[21px] w-[21px]" />
            <span className="ml-[6px]">{provider.rating}</span>
            <span className="ml-5">{provider.reviewCount} reviews</span>
          </div>

          <div className="mt-[7px] flex flex-col gap-[7px]">
            {provider.reviews.map((review) => (
              <div
                key={review.id}
                className="box-border h-[83px] rounded-[10px] border border-[#818080] bg-white px-[10px] pt-[10px]"
              >
                <p className="m-0 text-[11px] leading-[13px]">{review.reviewerName}</p>
                <div className="mt-[1px] flex">
                  {Array.from({ length: review.rating }, (_, i) => (
                    <img key={i} src={starIcon} alt="" className="h-[11px] w-[11px]" />
                  ))}
                </div>
                <p className="m-0 mt-[3px] text-[9px] leading-[11px]">
                  Service Availed: {review.serviceAvailed}
                </p>
                <p className="m-0 mt-[3px] max-w-[188px] text-[8px] leading-[10px]">{review.comment}</p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleChoose}
            className="mx-auto mt-[41px] box-border flex h-[46px] w-full max-w-[348px] cursor-pointer items-center justify-center rounded-lg border border-black/30 bg-gradient-to-r from-[#0255AF] to-[#04A5A5] font-[Quicksand] text-[16px] font-bold leading-[23px] text-white"
          >
            Choose this Service Provider
          </button>
        </div>
      </div>
    </CustomerSidebar>
  );
}