import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSubscription } from '../hooks/useSubscription';
import { SubscriptionBadge } from './SubscriptionBadge';

export function Header() {
  const { user, signOut } = useAuth();
  const { activePlanName } = useSubscription(user?.id);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="header">
      <div className="header__inner">
        <Link to="/" className="header__logo">
          <span className="header__logo-mark">FF</span>
          <span className="header__logo-text">FreshlyForward</span>
        </Link>

        <nav className="header__nav">
          <Link to="/pricing" className="header__nav-link">Pricing</Link>

          {user ? (
            <div className="header__user">
              {activePlanName && <SubscriptionBadge planName={activePlanName} />}
              <span className="header__email">{user.email}</span>
              <button onClick={handleSignOut} className="btn btn--ghost btn--sm">
                Sign out
              </button>
            </div>
          ) : (
            <div className="header__auth">
              <Link to="/login" className="btn btn--ghost btn--sm">Sign in</Link>
              <Link to="/login?tab=signup" className="btn btn--primary btn--sm">Get started</Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}