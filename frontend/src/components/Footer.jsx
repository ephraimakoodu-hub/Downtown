
import { Link } from 'react-router-dom';
import { business } from '../config.js';

const WHATSAPP_NUMBER = '2349047246662';

const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  'Hello Downtown Fashion and Mall, I would like to make an enquiry.'
)}`;

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">

          <div className="footer-about">
            <h2 className="footer-brand">
              {business.tradingName || 'Downtown Fashion & Mall'}
            </h2>

            <p className="muted">
              Your destination for quality fashion, accessories
              and lifestyle products.
            </p>

            <p className="muted">
              {business.town}, {business.state}
            </p>
          </div>

          <nav aria-label="Shopping">
            <h3>Shopping</h3>
            <ul>
              <li><Link to="/products">Shop all products</Link></li>
              <li><Link to="/cart">My shopping cart</Link></li>
            </ul>
          </nav>

          <nav aria-label="Customer information">
            <h3>Information</h3>
            <ul>
              <li><Link to="/privacy">Privacy policy</Link></li>
              <li><Link to="/terms">Terms and conditions</Link></li>
              <li><Link to="/refunds">Returns policy</Link></li>
            </ul>
          </nav>

          <div className="footer-contact">
            <h3>Contact Us</h3>

            <p>
              Oja Oba Central Market, Block A,
              Shop A94/95, Ado-Ekiti, Ekiti State.
            </p>

            <a
              className="footer-whatsapp"
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Chat with Downtown Fashion and Mall on WhatsApp"
            >
              Chat with us on WhatsApp
            </a>
          </div>

        </div>

        <div className="footer-bottom">
          <p className="footer-copyright">
            © {new Date().getFullYear()} Downtown Fashion & Mall.
            All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}