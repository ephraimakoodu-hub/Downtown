import { Link } from 'react-router-dom';
import { business } from '../config.js';

const WHATSAPP_NUMBER = '2349047246662';

const WHATSAPP_LINK =
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    'Hello Downtown Supermarket, I would like to make an enquiry.'
  )}`;

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">

        <div className="footer-grid">

          {/* STORE INFORMATION */}
          <div className="footer-about">
            <h2 className="footer-brand">
              {business.tradingName || 'Downtown Supermarket'}
            </h2>

            <p className="muted">
              Your trusted shopping destination for quality products
              and everyday essentials.
            </p>

            <p className="muted">
              {business.town}, {business.state}
            </p>
          </div>

          {/* SHOPPING LINKS */}
          <nav aria-label="Shopping">
            <h3>Shopping</h3>
            <ul>
              <li>
                <Link to="/products">Shop all products</Link>
              </li>
              <li>
                <Link to="/cart">My shopping cart</Link>
              </li>
            </ul>
          </nav>

          {/* POLICIES */}
          <nav aria-label="Policies">
            <h3>Customer Information</h3>
            <ul>
              <li><Link to="/privacy">Privacy policy</Link></li>
              <li><Link to="/terms">Terms and conditions</Link></li>
              <li><Link to="/cookies">Cookie and storage policy</Link></li>
              <li><Link to="/refunds">Refund and returns policy</Link></li>
            </ul>
          </nav>

          {/* CONTACT */}
          <div className="footer-contact">
            <h3>Contact Us</h3>

            <div className="footer-contact-item">
              <span className="footer-contact-icon">📍</span>

              <div>
                <strong>Visit Our Store</strong>
                <p>
                  Oja Oba Central Market,<br />
                  Block A, Shop A94/95,<br />
                  Ado-Ekiti, Ekiti State, Nigeria.
                </p>
              </div>
            </div>

            <div className="footer-contact-item">
              <span className="footer-contact-icon">💬</span>

              <div>
                <strong>WhatsApp</strong>
                <p>09047246662</p>

                <a
                  className="footer-whatsapp"
                  href={WHATSAPP_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Chat with Downtown Supermarket on WhatsApp"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M20.52 3.48A11.87 11.87 0 0 0 12.08 0C5.5 0 .15 5.35.15 11.93c0 2.1.55 4.15 1.6 5.95L.05 24l6.27-1.64a11.9 11.9 0 0 0 5.76 1.47h.01c6.58 0 11.93-5.35 11.93-11.93 0-3.19-1.24-6.19-3.5-8.42ZM12.09 21.8a9.9 9.9 0 0 1-5.05-1.38l-.36-.21-3.72.97.99-3.63-.24-.37a9.85 9.85 0 0 1-1.52-5.25c0-5.47 4.45-9.92 9.92-9.92a9.86 9.86 0 0 1 7.02 2.91 9.86 9.86 0 0 1 2.9 7.02c0 5.47-4.45 9.92-9.94 9.92Zm5.44-7.43c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.47-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.2 5.09 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.08-.12-.27-.2-.57-.35Z" />
                  </svg>

                  Chat with us
                </a>
              </div>
            </div>

            <p className="footer-contact-note">
              Have a question about a product or order?
              Send us a message on WhatsApp.
            </p>
          </div>

        </div>

        <div className="footer-bottom">
          <p className="footer-note">
            Prices are displayed in Nigerian naira (₦).
          </p>

          <p className="footer-copyright">
            © {new Date().getFullYear()} Downtown Supermarket.
            All rights reserved.
          </p>
        </div>

      </div>
    </footer>
  );
}