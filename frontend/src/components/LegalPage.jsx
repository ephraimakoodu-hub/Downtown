import { business } from '../config.js';

// Shows a value from config or a clearly marked gap. Never invent these details.
export const Fill = ({ value, label }) => (value ? <>{value}</> : <mark className="placeholder">[{label}: to be provided by the business]</mark>);

export default function LegalPage({ title, children }) {
  return (
    <div className="container page legal">
      <h1>{title}</h1>
      <div className="alert" role="note">
        <strong>Draft for review.</strong> This page describes how this website currently works. It has not been reviewed by a lawyer and must be checked by the business and a qualified Nigerian legal adviser before publication. Highlighted gaps must be filled with verified information.
      </div>
      <p className="muted">Operated by <Fill value={business.legalEntityName} label="Legal entity name" /> trading as {business.tradingName}, {business.town}. Contact: <Fill value={business.email} label="Contact email" />.</p>
      {children}
    </div>
  );
}
