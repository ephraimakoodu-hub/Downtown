import LegalPage, { Fill } from '../components/LegalPage.jsx';
import { business } from '../config.js';

export function Privacy() {
  return (
    <LegalPage title="Privacy policy">
      <h2>What we collect</h2>
      <p>When you create an account we collect your name, email address and a password (stored only as a one-way hash). When you place an order we collect your phone number and, for delivery, your delivery address, plus the items you ordered. Our servers also keep technical logs of requests, which include a request ID, the page requested and the time.</p>
      <h2>Why we collect it</h2>
      <p>To create and secure your account, to prepare and deliver or hand over your orders, to handle refund requests, and to keep the service secure. We do not collect information we do not need for these purposes.</p>
      <h2>Who receives it</h2>
      <p>Supermarket staff who handle orders can see the details needed to fulfil them. No analytics, advertising or tracking services are used on this site. Payment provider: <Fill value={null} label="Payment provider and what it receives" />. Hosting provider: <Fill value={null} label="Hosting provider" />.</p>
      <h2>How long we keep it</h2>
      <p><Fill value={null} label="Retention periods for accounts, orders and logs" /></p>
      <h2>Your choices and rights</h2>
      <p>You can change your password in your account. To ask about, correct or delete your information, contact us at <Fill value={business.email} label="Contact email" />. <Fill value={null} label="Statement of rights and complaint route under Nigerian data protection law, after legal review" /></p>
      <h2>Children</h2>
      <p><Fill value={null} label="Policy on children's data, after legal review" /></p>
    </LegalPage>
  );
}

export function Terms() {
  return (
    <LegalPage title="Terms and conditions">
      <h2>Using this site</h2>
      <p>You can browse products without an account. You need an account to place orders. Keep your password private and tell us if you think someone else has used your account.</p>
      <h2>Products and prices</h2>
      <p>Prices are shown in Nigerian naira. The final total is calculated by our system when you place an order. Stock shown on the site can change, and an order may be declined if items are no longer available.</p>
      <h2>Orders</h2>
      <p>Placing an order reserves the items. An order is not final until the supermarket confirms it. You can cancel an order online before it is processed.</p>
      <h2>Delivery and pickup</h2>
      <p>Areas served: <Fill value={business.deliveryAreas} label="Delivery areas" />. Delivery fee and times: <Fill value={null} label="Delivery fee and delivery time promises" />. Pickup: <Fill value={business.pickupAvailable == null ? null : business.pickupAvailable ? 'Available' : 'Not available'} label="Pickup availability" />.</p>
      <h2>Payment</h2>
      <p><Fill value={null} label="Accepted payment methods and when payment is taken" /></p>
      <h2>Liability and governing law</h2>
      <p><Fill value={null} label="Liability, governing law and dispute terms, after legal review" /></p>
    </LegalPage>
  );
}

export function Cookies() {
  return (
    <LegalPage title="Cookie and storage policy">
      <p>This site currently uses only what it needs to work. It does not use analytics, advertising or tracking cookies, and it loads no third-party scripts, fonts or embeds.</p>
      <table className="table">
        <caption className="visually-hidden">Cookies and browser storage used by this site</caption>
        <thead><tr><th scope="col">Name</th><th scope="col">Purpose</th><th scope="col">Type</th></tr></thead>
        <tbody>
          <tr><td data-label="Name">ds_session</td><td data-label="Purpose">Keeps you signed in</td><td data-label="Type">Cookie, set when you sign in, removed when you sign out or after 8 hours</td></tr>
          <tr><td data-label="Name">ds_cart_v1</td><td data-label="Purpose">Remembers product numbers and quantities in your cart</td><td data-label="Type">Browser local storage, stays on your device</td></tr>
        </tbody>
      </table>
      <p>If optional analytics or marketing tools are added later, this page must be updated and a consent choice must be shown before those tools load. <Fill value={null} label="Legal review of whether a consent banner is required for the current essential-only setup" /></p>
    </LegalPage>
  );
}

export function Refunds() {
  return (
    <LegalPage title="Refund and returns policy">
      <h2>How to request a refund</h2>
      <p>Sign in, open the order under My orders, and choose Request a refund once the order is delivered or cancelled. Staff review each request and record their decision.</p>
      <h2>Time limits and eligible items</h2>
      <p>Refund period: <Fill value={null} label="Refund period" />. Items that cannot be returned: <Fill value={null} label="Non-returnable items, for example perishables" />.</p>
      <h2>How refunds are paid</h2>
      <p><Fill value={null} label="Refund method and timing" /></p>
    </LegalPage>
  );
}
