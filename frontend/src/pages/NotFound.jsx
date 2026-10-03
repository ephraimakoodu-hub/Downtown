import { Link } from 'react-router-dom';
import { EmptyState } from '../components/States.jsx';

export default function NotFound() {
  return (
    <div className="container page">
      <EmptyState title="Page not found" actions={<Link className="btn" to="/products">Shop groceries</Link>}>
        The address may be mistyped or the page may have moved.
      </EmptyState>
    </div>
  );
}
