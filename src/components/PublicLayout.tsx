import { Link } from 'react-router-dom'
import { Menu, X, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'

// Homepage Redesign Phase 1 / Task 1: restructured per the owner-approved
// nav in docs/superpowers/specs/2026-09-02-homepage-design-north-star.md
// (locked decision #3) -- Product (dropdown) / How It Works / Career
// Compass / Pricing / Resources (dropdown) / Sign In. Every route the old
// flat nav exposed stays reachable (Career Compass promoted to a direct
// top-level link and relabeled from "Free Assessment"; Services and Why
// FreshlyForward moved into the Product dropdown; The Forward Feed and
// About moved into the Resources dropdown) -- see PublicLayout.test.tsx's
// route-coverage test.
const productLinks = [
  ['/services', 'Services'],
  ['/why-freshlyforward', 'Why FreshlyForward'],
] as const

const primaryNav = [
  ['/how-it-works', 'How It Works'],
  ['/career-compass', 'Career Compass'],
  ['/pricing', 'Pricing'],
] as const

const resourcesLinks = [
  ['/forward-feed', 'The Forward Feed'],
  ['/about', 'About'],
] as const

function NavDropdown({
  label,
  links,
  onNavigate,
}: {
  label: string
  links: readonly (readonly [string, string])[]
  onNavigate: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  return (
    <div className="nav-dropdown" ref={ref}>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="nav-dropdown-trigger"
      >
        {label} <ChevronDown size={14} />
      </button>
      {open && (
        <div className="nav-dropdown-menu">
          {links.map(([to, linkLabel]) => (
            <Link
              key={to}
              to={to}
              onClick={() => {
                setOpen(false)
                onNavigate()
              }}
            >
              {linkLabel}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="FreshlyForward home">
      <img src="/images/c1d368c4-ef41-494f-9a54-f5303e6f864d.png?v=2" alt="" />
    </Link>
  )
}

export function SiteHeader({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const [open, setOpen] = useState(false)
  const { user, signOut } = useAuth()

  return (
    <header className={`site-header ${variant === 'dark' ? 'site-header-dark' : ''}`}>
      <div className="shell header-inner">
        <Logo />
        <button
          className="menu-button"
          type="button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X /> : <Menu />}
        </button>
        <nav className={open ? 'nav-open' : ''} aria-label="Primary navigation">
          <NavDropdown label="Product" links={productLinks} onNavigate={() => setOpen(false)} />
          {primaryNav.map(([to, label]) => (
            <Link key={to} to={to} onClick={() => setOpen(false)}>
              {label}
            </Link>
          ))}
          <NavDropdown label="Resources" links={resourcesLinks} onNavigate={() => setOpen(false)} />
          <div className="nav-actions">
            {user ? (
              <>
                <Link to="/dashboard" className="nav-login" onClick={() => setOpen(false)}>
                  Dashboard
                </Link>
                <button
                  className="button button-primary button-small"
                  onClick={() => {
                    signOut()
                    setOpen(false)
                  }}
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link to="/signin" className="nav-login" onClick={() => setOpen(false)}>
                  Sign In
                </Link>
                <Link to="/signup" className="button button-primary button-small" onClick={() => setOpen(false)}>
                  Get started
                </Link>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  )
}

export function SiteFooter() {
  const { role } = useAuth()

  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div className="footer-brand">
          <Logo />
          <p>Human-led career search support for people ready to move forward with intention.</p>
        </div>
        <div>
          <strong>Explore</strong>
          <Link to="/how-it-works">How It Works</Link>
          <Link to="/services">Services</Link>
          <Link to="/pricing">Pricing</Link>
          <Link to="/forward-feed">The Forward Feed</Link>
          <Link to="/faq">FAQ</Link>
        </div>
        <div>
          <strong>Company</strong>
          <Link to="/about">About</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/why-freshlyforward">Why FreshlyForward</Link>
          <Link to="/authorization">Authorization</Link>
        </div>
        <div>
          <strong>Legal</strong>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/signin">Client login</Link>
          <Link to="/signup">Get started</Link>
        </div>
      </div>
      <div className="shell footer-bottom">
        <span>&copy; {new Date().getFullYear()} FreshlyForward. All rights reserved.</span>
        <span>Real people. Thoughtful work. Forward momentum.</span>
      </div>
      {role === 'admin' && (
        <div className="shell" style={{ paddingTop: '10px' }}>
          <Link to="/admin" style={{ fontSize: '.7rem', color: '#9aa6b4', opacity: .6 }}>Admin</Link>
        </div>
      )}
    </footer>
  )
}
