import { useState } from 'react';

/* =====================================================================================
   USER AVATAR — shared profile picture for the header, profile banners and messaging
   -------------------------------------------------------------------------------------
   Shows the person's real profile photo when the backend gives us a display-ready URL
   (user.photoUrl from GET /api/auth/me, or conversation.avatarUrl from
   GET /api/conversations — both are short-lived signed URLs minted by ServEaseBackend).
   Falls back to the blue initial circle from the Figma design when there is no photo or
   the signed URL has expired / fails to load, so a broken image is never shown.
   ===================================================================================== */
export default function UserAvatar({
  name = '',
  src = null,
  initials, // optional override (e.g. the provider sidebar's two-letter initials)
  sizeClass, // e.g. 'h-[50px] w-[50px]'
  textClass, // e.g. 'text-[24px] leading-[29px]'
  dot = false, // red unread dot (MessagingWidget inbox)
  className = '',
}) {
  // Remember which URL failed, so a fresh signed URL for the same person is retried
  // (the messaging inbox re-polls and gets new signed URLs every few seconds).
  const [failedSrc, setFailedSrc] = useState(null);
  const showPhoto = Boolean(src) && src !== failedSrc;
  const fallback = initials || (name || '').trim()[0]?.toUpperCase() || '';

  return (
    <span
      className={`relative flex flex-none items-center justify-center overflow-hidden rounded-full bg-[#0255AF] font-[Inter] font-bold text-white ${sizeClass} ${textClass} ${className}`}
    >
      {showPhoto ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        fallback
      )}
      {dot && (
        <span className="absolute right-0 top-0 h-[14px] w-[14px] rounded-full border-2 border-white bg-[#D32F2F]" />
      )}
    </span>
  );
}
