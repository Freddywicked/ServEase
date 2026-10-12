import { useEffect, useRef, useState } from 'react';
import { MessageSquare, Minus, X } from 'lucide-react';
import writeIcon from '../assets/icon_write.png';
import ellipseIcon from '../assets/icon_ellipse.png';
import {
  getConversations,
  getConversationMessages,
  sendConversationMessage,
} from '../api/client';

/* =====================================================================================
   MESSAGING WIDGET — floating chat for every customer and service provider screen
   -------------------------------------------------------------------------------------
   Rendered once inside CustomerSidebar (viewer="customer") and ServiceProviderSidebar
   (viewer="provider"), so it appears on every screen that uses those sidebars.

   WHAT THE USER SEES (bottom-right corner)
     - round message button      -> opens the "Messages" list (all conversations)
     - round initial badges above -> one per person with unread messages (red number);
                                     clicking one opens that conversation directly
     - chat popup                -> name + Online pill, minimize, close, messages, input

   DIFFERENT POINT OF VIEW
     The same conversation looks different to each person: a customer sees the service
     provider as the other person and a provider sees the customer. The backend should
     return, for the LOGGED-IN user, the *other* participant plus each message with
     `fromMe` (message.senderId === loggedInUser.id). The widget never needs the role to
     decide who is "You": it only uses `fromMe`. `viewer` is used here just to pick the
     hard-coded sample data.

   OPEN A CHAT FROM ANYWHERE (e.g. the "Message" button on a request)
     import { openChat } from '../components/MessagingWidget';
     openChat({ id: request.providerId, name: request.providerName });

   BACKEND INTEGRATION (READY)
   Everything the widget needs goes through `messagesService` below. It returns hard-coded
   data now; replace each function body with the commented call. Proposed endpoints
   (rename to match ServEaseBackend):

     GET  /api/messages/conversations
          -> [{ id, participant: { id, name, online }, unreadCount,
                messages: [{ id, fromMe, text, sentAt }] }]     (at least the latest message)
     GET  /api/messages/conversations/:id/messages               (full history, oldest first)
     POST /api/messages/conversations/:id/messages   body: { text }  -> { id, fromMe, text, sentAt }
     POST /api/messages/conversations/:id/read                   (clears unreadCount)
     POST /api/messages/conversations   body: { participantId, requestId? }  -> conversation
          (used when you message someone you have no conversation with yet)

   New messages / online status: poll the list every ~10 seconds while the tab is visible,
   or push them with WebSockets / Socket.IO. Either way, only `setConversations(...)` has
   to be called with the new data. Only allow a customer and a provider to message each
   other when they share a service request.
   ===================================================================================== */

const POLL_INTERVAL_MS = 10000; // refresh the inbox every 10 s (no sockets yet)
const MAX_UNREAD_BADGES = 3;
export const OPEN_CHAT_EVENT = 'servease:open-chat';

// Open a conversation from any component. `participant` = { id, name }.
export const openChat = (participant) =>
  window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT, { detail: participant }));

/* ------------------------------ DATA LAYER (swap for the backend) ------------------------------ */

/* ------------------------------ DATA LAYER (live backend) ------------------------------ */

// The backend keeps ONE conversation per service request; the conversation id is
// the request reference ("SR-0007"). GET /api/conversations returns the list for
// the logged-in user (works for both customers and providers), and
// GET /api/conversations/:id/messages marks the thread read for the viewer.
const toConversation = (c) => ({
  id: c.id,
  participant: { id: c.participantId, name: c.name, online: Boolean(c.isOnline) },
  unreadCount: c.hasUnread ? 1 : 0,
  // Preview line for the list; the full history loads when the chat is opened.
  // The list endpoint sends no timestamp, so sentAt stays null (the UI hides it).
  messages: c.lastMessage
    ? [{ id: `${c.id}-last`, fromMe: false, text: c.lastMessage, sentAt: null }]
    : [],
});

// Set by the widget on every render so messagesService can compute `fromMe`:
// the backend labels each message sender 'customer' | 'provider'.
let activeViewer = 'customer';
const toMessage = (m) => ({
  id: m.id,
  fromMe: m.sender === activeViewer,
  text: m.text,
  sentAt: m.createdAt,
});

const messagesService = {
  async listConversations() {
    const data = await getConversations();
    return (data?.conversations ?? []).map(toConversation);
  },

  // Full history (oldest first); also marks the thread read server-side.
  async getMessages(conversationId) {
    const data = await getConversationMessages(conversationId);
    return (data?.messages ?? []).map(toMessage);
  },

  async sendMessage(conversationId, text) {
    const data = await sendConversationMessage(conversationId, text);
    return { ...toMessage(data.message), fromMe: true };
  },

  // A chat can only exist between a customer and a provider who share a service
  // request, so there is no "create conversation" call: `participant` carries the
  // requestId (from a request card / notification) and/or the other person's user
  // id, and we match it against the conversations the backend already returns.
  async startConversation(participant) {
    const list = await messagesService.listConversations();
    const found = list.find(
      (c) =>
        (participant.requestId && c.id === participant.requestId) ||
        (participant.id && c.participant.id === participant.id)
    );
    if (found) return found;
    // The request is shared but has no messages yet — open an empty thread;
    // sending the first message works because the id is the request reference.
    if (participant.requestId) {
      return {
        id: participant.requestId,
        participant: {
          id: participant.id || null,
          name: participant.name || 'Conversation',
          online: false,
        },
        unreadCount: 0,
        messages: [],
      };
    }
    return null; // no shared request with this person — nothing to open
  },
};

/* ------------------------------ helpers ------------------------------ */

// 55 minutes ago -> "55m"
const relativeTime = (iso) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

// "Jun 24 9:12 AM"
const formatStamp = (iso) =>
  new Date(iso)
    .toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    .replace(',', '');

const lastMessageOf = (conversation) => conversation.messages[conversation.messages.length - 1];

const sortByLatest = (list) =>
  [...list].sort((a, b) => {
    const aTime = lastMessageOf(a)?.sentAt ?? '';
    const bTime = lastMessageOf(b)?.sentAt ?? '';
    return bTime.localeCompare(aTime);
  });

/* ------------------------------ small UI parts ------------------------------ */

function Avatar({ name, sizeClass, textClass, dot = false }) {
  return (
    <span
      className={`relative flex flex-none items-center justify-center rounded-full bg-[#0255AF] font-[Inter] font-bold text-white ${sizeClass} ${textClass}`}
    >
      {name?.[0]?.toUpperCase()}
      {dot && (
        <span className="absolute right-0 top-0 h-[14px] w-[14px] rounded-full border-2 border-white bg-[#D32F2F]" />
      )}
    </span>
  );
}

/* ------------------------------ widget ------------------------------ */

export default function MessagingWidget({ viewer = 'customer' }) {
  activeViewer = viewer; // the service layer uses this to compute message.fromMe
  const [conversations, setConversations] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeChatId, setActiveChatId] = useState(null);
  const [minimized, setMinimized] = useState(false);
  const [draft, setDraft] = useState('');

  const conversationsRef = useRef([]);
  conversationsRef.current = conversations;
  const messagesEndRef = useRef(null);

  const activeChat = conversations.find((c) => c.id === activeChatId) || null;
  const unreadHeads = sortByLatest(conversations)
    .filter((c) => c.unreadCount > 0)
    .slice(0, MAX_UNREAD_BADGES);

  // Load conversations (and optionally poll).
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      messagesService
        .listConversations(viewer)
        .then((data) => {
          // Keep a conversation that was just started locally and is not on the server yet.
          if (!cancelled) {
            setConversations((prev) => {
              const localOnly = prev.filter(
                (p) => p.messages.length === 0 && !data.some((d) => d.participant.id === p.participant.id)
              );
              return [...data, ...localOnly];
            });
          }
        })
        .catch((err) => console.error('Failed to load conversations', err));

    load();
    const timer = POLL_INTERVAL_MS > 0 ? setInterval(load, POLL_INTERVAL_MS) : null;
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [viewer]);

  const openConversation = (conversationId) => {
    setPanelOpen(false);
    setMinimized(false);
    setActiveChatId(conversationId);
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c))
    );
    // Load the full history; this also marks the thread read on the server.
    messagesService
      .getMessages(conversationId)
      .then((messages) =>
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? { ...c, messages } : c))
        )
      )
      .catch((err) => console.error('Failed to load messages', err));
  };

  // Let any screen open a chat, e.g. the "Message" button on a request.
  useEffect(() => {
    const onOpenChat = async (event) => {
      const participant = event.detail;
      if (!participant?.id && !participant?.requestId) return;
      let conversation = conversationsRef.current.find(
        (c) =>
          (participant.requestId && c.id === participant.requestId) ||
          (participant.id && c.participant.id === participant.id)
      );
      if (!conversation) {
        conversation = await messagesService.startConversation(participant);
        if (!conversation) {
          // No shared service request with this person — open the inbox instead.
          setPanelOpen(true);
          return;
        }
        setConversations((prev) =>
          prev.some((c) => c.id === conversation.id) ? prev : [...prev, conversation]
        );
      }
      openConversation(conversation.id);
    };
    window.addEventListener(OPEN_CHAT_EVENT, onOpenChat);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, onOpenChat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Escape closes the Messages list.
  useEffect(() => {
    if (!panelOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setPanelOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [panelOpen]);

  // Keep the newest message in view.
  useEffect(() => {
    if (activeChat && !minimized) messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [activeChat?.messages.length, activeChatId, minimized]); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePanel = () => {
    setActiveChatId(null);
    setPanelOpen((open) => !open);
  };

  const closeChat = () => {
    setActiveChatId(null);
    setMinimized(false);
    setDraft('');
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !activeChat) return;

    const conversationId = activeChat.id;
    const optimistic = {
      id: `tmp-${Date.now()}`,
      fromMe: true,
      text,
      sentAt: new Date().toISOString(),
    };
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, messages: [...c.messages, optimistic] } : c))
    );
    setDraft('');

    try {
      const saved = await messagesService.sendMessage(conversationId, text);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? { ...c, messages: c.messages.map((m) => (m.id === optimistic.id ? saved : m)) }
            : c
        )
      );
    } catch (err) {
      // TODO (BACKEND): show a "failed to send, retry" state on the message
      console.error('Failed to send message', err);
    }
  };

  const handleNewMessage = () => {
    // TODO (BACKEND): let the user pick someone they share a service request with,
    // then call openChat({ id, name }) (this creates the conversation if needed).
    console.log('New message clicked');
  };

  return (
    <>
      {/* Messages list */}
      {panelOpen && (
        <section
          aria-label="Messages"
          className="fixed bottom-[51px] right-[103px] z-40 box-border flex h-[467px] max-h-[calc(100vh-110px)] w-[499px] max-w-[calc(100vw-130px)] flex-col rounded-[10px] border border-[#484040] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
        >
          <div className="flex items-center justify-between px-6 pt-5">
            <h2 className="m-0 font-[Inter] text-[24px] font-bold leading-[29px] text-[#292727]">
              Messages
            </h2>
            <button
              type="button"
              onClick={handleNewMessage}
              aria-label="New message"
              className="relative h-[56px] w-[56px] flex-none cursor-pointer border-none bg-transparent p-0"
            >
              <img src={ellipseIcon} alt="" className="absolute inset-0 h-full w-full" />
              <img
                src={writeIcon}
                alt=""
                className="absolute left-1/2 top-1/2 h-[26px] w-[26px] -translate-x-1/2 -translate-y-1/2 object-contain"
              />
            </button>
          </div>
          <hr className="mx-6 mb-0 mt-1 border-0 border-t border-[#B1A8A8]" />

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3">
            {conversations.length === 0 ? (
              <p className="m-0 mt-6 text-center font-[Roboto] text-[14px] font-medium text-[#817C7C]">
                No messages yet
              </p>
            ) : (
              sortByLatest(conversations).map((c) => {
                const last = lastMessageOf(c);
                const unread = c.unreadCount > 0;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => openConversation(c.id)}
                    className="flex w-full cursor-pointer items-center gap-4 rounded-[8px] border-none bg-transparent px-0 py-[9px] text-left hover:bg-[#F6FAFF]"
                  >
                    <Avatar
                      name={c.participant.name}
                      sizeClass="h-[56px] w-[56px]"
                      textClass="text-[24px]"
                      dot={unread}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-[Inter] text-[15px] font-bold leading-[20px] text-[#292727]">
                        {c.participant.name}
                      </span>
                      {last && (
                        <span
                          className={`block truncate font-[Inter] text-[14px] leading-[20px] text-[#292727] ${
                            unread ? 'font-bold' : 'font-normal'
                          }`}
                        >
                          {last.fromMe ? 'You: ' : ''}
                          {last.text}
                          {last.sentAt ? ` | ${relativeTime(last.sentAt)}` : ''}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* Chat popup */}
      {activeChat && (
        <section
          aria-label={`Chat with ${activeChat.participant.name}`}
          className={`fixed bottom-0 right-[90px] z-40 box-border flex w-[380px] max-w-[calc(100vw-110px)] flex-col rounded-[10px] border border-[#818080] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.12)] ${
            minimized ? '' : 'h-[466px] max-h-[calc(100vh-80px)]'
          }`}
        >
          <div className="flex items-center gap-3 px-5 pb-1 pt-4">
            <h2 className="m-0 min-w-0 truncate font-[Inter] text-[16px] font-bold leading-[20px] text-[#292727]">
              {activeChat.participant.name}
            </h2>
            {activeChat.participant.online && (
              <span className="flex-none rounded-full bg-[#5CB85C] px-3 py-[2px] font-[Inter] text-[12px] leading-[16px] text-white">
                Online
              </span>
            )}
            <span className="ml-auto flex flex-none items-center gap-3">
              <button
                type="button"
                onClick={() => setMinimized((m) => !m)}
                aria-label={minimized ? 'Expand chat' : 'Minimize chat'}
                className="flex cursor-pointer items-center justify-center border-none bg-transparent p-0"
              >
                <Minus size={24} strokeWidth={2.5} color="#000" />
              </button>
              <button
                type="button"
                onClick={closeChat}
                aria-label="Close chat"
                className="flex cursor-pointer items-center justify-center border-none bg-transparent p-0"
              >
                <X size={24} strokeWidth={2.5} color="#000" />
              </button>
            </span>
          </div>

          {!minimized && (
            <>
              <hr className="mx-5 mb-0 mt-1 border-0 border-t border-[#B1A8A8]" />

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3 [scrollbar-width:thin]">
                {activeChat.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`mb-3 flex flex-col ${m.fromMe ? 'items-end' : 'items-start'}`}
                  >
                    <p
                      className={`m-0 max-w-[226px] break-words rounded-[8px] px-3 py-2 font-[Inter] text-[13px] leading-[18px] ${
                        m.fromMe ? 'bg-[#577FBB] text-white' : 'bg-[#EDEDED] text-[#292727]'
                      }`}
                    >
                      {m.text}
                    </p>
                    <span className="mt-1 font-[Inter] text-[10px] leading-[12px] text-[#7C7979]">
                      {formatStamp(m.sentAt)}
                    </span>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSend} className="flex items-center gap-2 px-4 pb-4 pt-2">
                <input
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type a message..."
                  aria-label="Type a message"
                  className="box-border h-[34px] min-w-0 flex-1 rounded-[8px] border border-[#818080] bg-white px-3 font-[Inter] text-[12px] text-[#292727] outline-none focus:border-[#0255AF]"
                />
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  className="h-[35px] w-[53px] flex-none cursor-pointer rounded-[8px] border-none bg-[#0255AF] font-[Inter] text-[11px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Send
                </button>
              </form>
            </>
          )}
        </section>
      )}

      {/* Floating badges + message button */}
      <div className="fixed bottom-[68px] right-5 z-40 flex flex-col items-center gap-[10px]">
        {unreadHeads.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => openConversation(c.id)}
            aria-label={`${c.participant.name}, ${c.unreadCount} unread message${c.unreadCount > 1 ? 's' : ''}`}
            title={c.participant.name}
            className="relative flex h-[67px] w-[67px] cursor-pointer items-center justify-center rounded-full border-none bg-[#0255AF] p-0 font-[Inter] text-[28px] font-bold text-white"
          >
            {c.participant.name[0].toUpperCase()}
            <span className="absolute -right-[2px] -top-[2px] flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-[#D32F2F] px-1 font-[Inter] text-[12px] font-bold leading-none text-white">
              {c.unreadCount}
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={togglePanel}
          aria-label="Messages"
          aria-expanded={panelOpen}
          className="flex h-[67px] w-[67px] cursor-pointer items-center justify-center rounded-full border-none bg-[#0255AF] p-0"
        >
          <MessageSquare size={28} color="#fff" />
        </button>
      </div>
    </>
  );
}
