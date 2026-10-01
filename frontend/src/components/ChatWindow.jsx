import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from './Button';
import Icon from './Icon';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function ChatWindow({ shopId, recipientName, existingConversation, customerId }) {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState(existingConversation || null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setConversation(existingConversation || null);
    setMessages([]);
    setOpen(false);
  }, [existingConversation]);

  const refreshMessages = async (conversationId) => {
    try {
      const { data } = await api.chat.messages(conversationId, token);
      setMessages(data);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  const openChat = async () => {
    if (!user) {
      navigate('/login', { state: { redirectTo: window.location.pathname } });
      return;
    }
    setOpen(true);
    setMessages([]);
    setError('');
    setLoading(true);
    try {
      const result = conversation
        ? { data: conversation }
        : await api.chat.openShop(shopId, token, customerId);
      setConversation(result.data);
      await refreshMessages(result.data.conversation_id);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const closeChat = () => {
    setOpen(false);
    setMessages([]);
    setConversation(existingConversation || null);
    setDraft('');
  };

  useEffect(() => {
    if (!open || !conversation?.conversation_id) return undefined;
    const timer = window.setInterval(() => refreshMessages(conversation.conversation_id), 4000);
    return () => window.clearInterval(timer);
  }, [open, conversation?.conversation_id]);

  const send = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !conversation || sending) return;
    setSending(true);
    try {
      await api.chat.send(conversation.conversation_id, body, token);
      setDraft('');
      await refreshMessages(conversation.conversation_id);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed bottom-20 right-4 z-40 md:bottom-6 md:right-8">
      {!open ? (
        <Button onClick={openChat} variant="secondary" className="shadow-card">
          <Icon name="chat" className="h-4 w-4" />
          Chat with {recipientName || 'artisan'}
        </Button>
      ) : (
        <section className="flex h-[min(29rem,calc(100dvh-8rem))] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-cream-300 bg-cream-100 shadow-card">
          <header className="flex items-center gap-3 bg-ink-800 px-4 py-3 text-cream-100">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-clay-500/30 text-clay-200">
              <Icon name="chat" className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold">{recipientName || 'Shop chat'}</p>
              <p className="text-[11px] text-cream-200/60">Messages stay between you both</p>
            </div>
            <button onClick={closeChat} aria-label="Close chat" className="rounded-lg p-1.5 text-cream-200/70 hover:bg-white/10 hover:text-white">
              <span className="text-lg leading-none">×</span>
            </button>
          </header>

          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-4 scroll-clean">
            {loading ? (
              <p className="pt-8 text-center text-[12px] text-ink-400">Opening a fresh chat…</p>
            ) : messages.length === 0 ? (
              <div className="px-5 pt-10 text-center">
                <Icon name="chat" className="mx-auto h-8 w-8 text-clay-300" />
                <p className="mt-3 text-[13px] font-semibold text-ink-600">Start the conversation</p>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-400">Ask about this piece, custom work, or visiting the shop.</p>
              </div>
            ) : (
              messages.map((message) => {
                const mine = message.sender_id === user?.user_id;
                return (
                  <div key={message.message_id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <p className={`max-w-[82%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${mine ? 'rounded-br-md bg-clay-500 text-white' : 'rounded-bl-md bg-white text-ink-700'}`}>
                      {message.body}
                    </p>
                  </div>
                );
              })
            )}
            {error && <p className="text-center text-[11.5px] text-clay-600">{error}</p>}
          </div>

          <form onSubmit={send} className="flex gap-2 border-t border-cream-300 bg-white p-3">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Write a message…"
              maxLength={1000}
              className="field-input !rounded-xl !px-3 !py-2 !text-[13px]"
              disabled={loading || !conversation}
            />
            <button type="submit" aria-label="Send message" disabled={!draft.trim() || sending} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-clay-500 text-white transition hover:bg-clay-600 disabled:cursor-not-allowed disabled:opacity-40">
              <Icon name="chevron" className="h-4 w-4 rotate-[-45deg]" strokeWidth={2.2} />
            </button>
          </form>
        </section>
      )}
    </div>
  );
}