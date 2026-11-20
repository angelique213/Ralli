// Preview text comes from the viewer's RLS-protected message query.
export default function ReplyPreview({ original, user, member, onOpen }) {
  const available = original && !Array.isArray(original) && !original.unsent_at && typeof original.body === 'string'
  const content = <><strong>{available ? (original.sender_id === user.id ? user.user_metadata?.display_name || user.user_metadata?.name || 'You' : member.display_name || 'Ralli Member') : 'Reply'}</strong><span>{original?.unsent_at ? 'This message was unsent.' : available ? original.body : 'Original message unavailable.'}</span></>
  return available && onOpen
    ? <button type="button" className="message-reply-preview" onClick={onOpen} aria-label="Go to original message">{content}</button>
    : <div className="message-reply-preview">{content}</div>
}
