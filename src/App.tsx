import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { SiteHeader, SiteFooter } from '@/components/PublicLayout'
import { LoadingScreen } from '@/components/LoadingScreen'
import { MemberLayout } from '@/components/MemberLayout'
import { StrategistLayout } from '@/components/StrategistLayout'
import { ProtectedRoute } from '@/components/ProtectedRoute'

// N9 (bundle code-splitting): every page below used to be a static
// top-level import, so all ~65 routes -- landing page through admin
// tooling -- shipped in one 3.6MB entry chunk regardless of which page a
// visitor actually loaded. `lazy()` defers each page's code (and its own
// dependency graph, e.g. the resume builder's export libraries) until its
// route is actually visited. The `.then(m => ({ default: m.X }))` adapter
// is needed because these are named exports and `React.lazy` requires a
// default export.
//
// Known, accepted tradeoff (per John Carter's N9 architecture review):
// creating a lazy element does NOT trigger its import -- only actually
// rendering it does. Since `ProtectedRoute` returns `<Navigate/>` before
// rendering its `children` when the visitor is unauthenticated/unauthorized,
// a gated route's page chunk is never fetched by a visitor who never
// legitimately reaches it. (Verified directly: a lazy factory wrapped in a
// gate that redirects before rendering children is never invoked.)
const LandingPage = lazy(() => import('@/pages/LandingPage').then((m) => ({ default: m.LandingPage })))
const PricingPage = lazy(() => import('@/pages/PricingPage').then((m) => ({ default: m.PricingPage })))
const HowItWorksPage = lazy(() => import('@/pages/HowItWorksPage').then((m) => ({ default: m.HowItWorksPage })))
const ServicesPage = lazy(() => import('@/pages/ServicesPage').then((m) => ({ default: m.ServicesPage })))
const WhyFreshlyForwardPage = lazy(() => import('@/pages/WhyFreshlyForwardPage').then((m) => ({ default: m.WhyFreshlyForwardPage })))
const AboutPage = lazy(() => import('@/pages/AboutPage').then((m) => ({ default: m.AboutPage })))
const ContactPage = lazy(() => import('@/pages/ContactPage').then((m) => ({ default: m.ContactPage })))
const FaqPage = lazy(() => import('@/pages/FaqPage').then((m) => ({ default: m.FaqPage })))
const ForwardFeedPage = lazy(() => import('@/pages/ForwardFeedPage').then((m) => ({ default: m.ForwardFeedPage })))
const ForwardFeedPostPage = lazy(() => import('@/pages/ForwardFeedPostPage').then((m) => ({ default: m.ForwardFeedPostPage })))
const PublicProfilePage = lazy(() => import('@/pages/PublicProfilePage').then((m) => ({ default: m.PublicProfilePage })))
const AuthorizationPage = lazy(() => import('@/pages/AuthorizationPage').then((m) => ({ default: m.AuthorizationPage })))
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage').then((m) => ({ default: m.PrivacyPage })))
const TermsPage = lazy(() => import('@/pages/TermsPage').then((m) => ({ default: m.TermsPage })))
const SignInPage = lazy(() => import('@/pages/SignInPage').then((m) => ({ default: m.SignInPage })))
const SignUpPage = lazy(() => import('@/pages/SignUpPage').then((m) => ({ default: m.SignUpPage })))
const CheckoutPage = lazy(() => import('@/pages/CheckoutPage').then((m) => ({ default: m.CheckoutPage })))
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage').then((m) => ({ default: m.OnboardingPage })))
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const CareerCompassIntroPage = lazy(() => import('@/pages/CareerCompassIntroPage').then((m) => ({ default: m.CareerCompassIntroPage })))
const CareerCompassAssessmentPage = lazy(() => import('@/pages/CareerCompassAssessmentPage').then((m) => ({ default: m.CareerCompassAssessmentPage })))
const CareerCompassResultsPage = lazy(() => import('@/pages/CareerCompassResultsPage').then((m) => ({ default: m.CareerCompassResultsPage })))
const CareerProfilePage = lazy(() => import('@/pages/CareerProfilePage').then((m) => ({ default: m.CareerProfilePage })))
const ForwardDnaPage = lazy(() => import('@/pages/ForwardDnaPage').then((m) => ({ default: m.ForwardDnaPage })))
const CareerVaultPage = lazy(() => import('@/pages/CareerVaultPage').then((m) => ({ default: m.CareerVaultPage })))
const ResumeIntelligencePage = lazy(() => import('@/pages/ResumeIntelligencePage').then((m) => ({ default: m.ResumeIntelligencePage })))
const ResumeBuilderPage = lazy(() => import('@/pages/ResumeBuilderPage').then((m) => ({ default: m.ResumeBuilderPage })))
const ResumeTailorPage = lazy(() => import('@/pages/ResumeTailorPage').then((m) => ({ default: m.ResumeTailorPage })))
const MembershipPage = lazy(() => import('@/pages/MembershipPage').then((m) => ({ default: m.MembershipPage })))
const CareerSuccessPage = lazy(() => import('@/pages/CareerSuccessPage').then((m) => ({ default: m.CareerSuccessPage })))
const TimelinePage = lazy(() => import('@/pages/TimelinePage').then((m) => ({ default: m.TimelinePage })))
const DesignSystemShowcasePage = lazy(() => import('@/pages/internal/DesignSystemShowcasePage').then((m) => ({ default: m.DesignSystemShowcasePage })))
const MessagesPage = lazy(() => import('@/pages/MessagesPage').then((m) => ({ default: m.MessagesPage })))
const MemberOpportunitiesPage = lazy(() => import('@/pages/MemberOpportunitiesPage').then((m) => ({ default: m.MemberOpportunitiesPage })))
const OpportunityEnginePage = lazy(() => import('@/pages/OpportunityEnginePage').then((m) => ({ default: m.OpportunityEnginePage })))
const LinkedInOptimizerPage = lazy(() => import('@/pages/LinkedInOptimizerPage').then((m) => ({ default: m.LinkedInOptimizerPage })))
const MemberApplicationsPage = lazy(() => import('@/pages/MemberApplicationsPage').then((m) => ({ default: m.MemberApplicationsPage })))
const WhyWeAppliedPage = lazy(() => import('@/pages/WhyWeAppliedPage').then((m) => ({ default: m.WhyWeAppliedPage })))
const FoundingMemberPage = lazy(() => import('@/pages/FoundingMemberPage').then((m) => ({ default: m.FoundingMemberPage })))
const FridayReportsPage = lazy(() => import('@/pages/FridayReportsPage').then((m) => ({ default: m.FridayReportsPage })))
const MockInterviewPage = lazy(() => import('@/pages/MockInterviewPage').then((m) => ({ default: m.MockInterviewPage })))
const CalendarPage = lazy(() => import('@/pages/CalendarPage').then((m) => ({ default: m.CalendarPage })))
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })))
const CommunicationPreferencesPage = lazy(() => import('@/pages/CommunicationPreferencesPage').then((m) => ({ default: m.CommunicationPreferencesPage })))
const ActivityFeedPage = lazy(() => import('@/pages/ActivityFeedPage').then((m) => ({ default: m.ActivityFeedPage })))
const InterviewsPage = lazy(() => import('@/pages/InterviewsPage').then((m) => ({ default: m.InterviewsPage })))
const ToolsPage = lazy(() => import('@/pages/ToolsPage').then((m) => ({ default: m.ToolsPage })))
const AchievementVaultPage = lazy(() => import('@/pages/AchievementVaultPage').then((m) => ({ default: m.AchievementVaultPage })))
const RoadmapPage = lazy(() => import('@/pages/RoadmapPage').then((m) => ({ default: m.RoadmapPage })))
const FeatureEntitlementsPage = lazy(() => import('@/pages/strategist/FeatureEntitlementsPage').then((m) => ({ default: m.FeatureEntitlementsPage })))
const StrategistDashboardPage = lazy(() => import('@/pages/strategist/StrategistDashboardPage').then((m) => ({ default: m.StrategistDashboardPage })))
const StrategistMembersPage = lazy(() => import('@/pages/strategist/StrategistMembersPage').then((m) => ({ default: m.StrategistMembersPage })))
const StrategistMemberWorkspacePage = lazy(() => import('@/pages/strategist/StrategistMemberWorkspacePage').then((m) => ({ default: m.StrategistMemberWorkspacePage })))
const StrategistOpportunitiesPage = lazy(() => import('@/pages/strategist/StrategistOpportunitiesPage').then((m) => ({ default: m.StrategistOpportunitiesPage })))
const StrategistOpportunityEnginePage = lazy(() => import('@/pages/strategist/StrategistOpportunityEnginePage').then((m) => ({ default: m.StrategistOpportunityEnginePage })))
const StrategistApplicationsPage = lazy(() => import('@/pages/strategist/StrategistApplicationsPage').then((m) => ({ default: m.StrategistApplicationsPage })))
const StrategistFridayReportsPage = lazy(() => import('@/pages/strategist/StrategistFridayReportsPage').then((m) => ({ default: m.StrategistFridayReportsPage })))
const AdminReportReviewPage = lazy(() => import('@/pages/strategist/AdminReportReviewPage').then((m) => ({ default: m.AdminReportReviewPage })))
const AdminDashboardPage = lazy(() => import('@/pages/strategist/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })))
const AdminMembersPage = lazy(() => import('@/pages/strategist/AdminMembersPage').then((m) => ({ default: m.AdminMembersPage })))
const AdminMemberDetailPage = lazy(() => import('@/pages/strategist/AdminMemberDetailPage').then((m) => ({ default: m.AdminMemberDetailPage })))
const BlogManagementPage = lazy(() => import('@/pages/strategist/BlogManagementPage').then((m) => ({ default: m.BlogManagementPage })))
const BlogPostEditorPage = lazy(() => import('@/pages/strategist/BlogPostEditorPage').then((m) => ({ default: m.BlogPostEditorPage })))

const publicRoutes = [
  '/', '/pricing', '/how-it-works', '/services', '/why-freshlyforward',
  '/about', '/contact', '/faq', '/authorization', '/privacy', '/terms',
  '/signin', '/signup', '/forward-feed', '/career-compass', '/u',
]

function App() {
  const { loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen />

  // '/career-compass' is a prefix match for BOTH '/career-compass/results'
  // (should get SiteHeader/SiteFooter -- a normal Persuade-mode page) and
  // '/career-compass/assessment' (should NOT -- WizardShell renders its own
  // full-page chrome, same as /onboarding). A plain startsWith() can't tell
  // those apart since they're siblings under the same base path, so the
  // assessment route is carved out explicitly here.
  const isPublicRoute =
    location.pathname !== '/career-compass/assessment' &&
    publicRoutes.some((route) =>
      route === '/' ? location.pathname === '/' : location.pathname.startsWith(route)
    )

  return (
    <>
      {isPublicRoute && <SiteHeader />}
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/why-freshlyforward" element={<WhyFreshlyForwardPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/forward-feed" element={<ForwardFeedPage />} />
        <Route path="/forward-feed/:slug" element={<ForwardFeedPostPage />} />

        {/* Forward Profiles: public, unauthenticated /u/:username page --
            distinct from the PRIVATE "Forward Profile" identity layer at
            /profile and /forward-dna. See
            docs/superpowers/plans/2026-09-09-forward-profiles-implementation.md */}
        <Route path="/u/:username" element={<PublicProfilePage />} />
        <Route path="/authorization" element={<AuthorizationPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/career-compass" element={<CareerCompassIntroPage />} />
        <Route path="/career-compass/results" element={<CareerCompassResultsPage />} />

        {/* Career Compass assessment: public/unprotected (anonymous-first
            design), but NOT in publicRoutes -- WizardShell provides its own
            full-page chrome, same pattern as /onboarding not double-wrapping
            with SiteHeader/SiteFooter. Unlike /onboarding it's intentionally
            NOT wrapped in ProtectedRoute or MemberLayout either. */}
        <Route path="/career-compass/assessment" element={<CareerCompassAssessmentPage />} />

        {/* Checkout */}
        <Route
          path="/checkout/:planSlug"
          element={
            <ProtectedRoute>
              <CheckoutPage />
            </ProtectedRoute>
          }
        />

        {/* Member routes */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <MemberLayout><OnboardingPage /></MemberLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <MemberLayout><DashboardPage /></MemberLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <MemberLayout><CareerProfilePage /></MemberLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/forward-dna"
          element={
            <ProtectedRoute>
              <ForwardDnaPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/career-vault"
          element={
            <ProtectedRoute>
              <CareerVaultPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/resume-intelligence"
          element={
            <ProtectedRoute>
              <ResumeIntelligencePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/resume-intelligence/builder/:resumeVersionId"
          element={
            <ProtectedRoute>
              <ResumeBuilderPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/resume-intelligence/tailor/:opportunityId"
          element={
            <ProtectedRoute>
              <ResumeTailorPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/membership"
          element={
            <ProtectedRoute>
              <MemberLayout><MembershipPage /></MemberLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/career-success"
          element={
            <ProtectedRoute feature="workplace_success_coaching" requiredPlan="career-concierge">
              <MemberLayout><CareerSuccessPage /></MemberLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/timeline"
          element={
            <ProtectedRoute>
              <MemberLayout><TimelinePage /></MemberLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages"
          element={
            <ProtectedRoute>
              <MemberLayout><MessagesPage /></MemberLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/opportunities"
          element={
            <ProtectedRoute>
              <MemberLayout><MemberOpportunitiesPage /></MemberLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/opportunity-engine"
          element={
            <ProtectedRoute>
              <MemberLayout><OpportunityEnginePage /></MemberLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/linkedin-optimizer"
          element={
            <ProtectedRoute>
              <MemberLayout><LinkedInOptimizerPage /></MemberLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/applications"
          element={
            <ProtectedRoute>
              <MemberLayout><MemberApplicationsPage /></MemberLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/why-we-applied/:applicationId"
          element={
            <ProtectedRoute>
              <MemberLayout><WhyWeAppliedPage /></MemberLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/founding-member"
          element={
            <ProtectedRoute>
              <MemberLayout><FoundingMemberPage /></MemberLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/friday-reports"
          element={
            <ProtectedRoute>
              <MemberLayout><FridayReportsPage /></MemberLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/mock-interviews"
          element={
            <ProtectedRoute feature="mock_interviews" requiredPlan="career-growth">
              <MemberLayout><MockInterviewPage /></MemberLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/calendar"
          element={
            <ProtectedRoute>
              <MemberLayout><CalendarPage /></MemberLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <MemberLayout><NotificationsPage /></MemberLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/communication"
          element={
            <ProtectedRoute>
              <MemberLayout><CommunicationPreferencesPage /></MemberLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/activity"
          element={
            <ProtectedRoute>
              <MemberLayout><ActivityFeedPage /></MemberLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/interviews"
          element={
            <ProtectedRoute>
              <MemberLayout><InterviewsPage /></MemberLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tools"
          element={
            <ProtectedRoute>
              <MemberLayout><ToolsPage /></MemberLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/achievement-vault"
          element={
            <ProtectedRoute feature="achievement_vault" requiredPlan="career-concierge">
              <MemberLayout><AchievementVaultPage /></MemberLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/roadmap"
          element={
            <ProtectedRoute feature="career_roadmap" requiredPlan="career-concierge">
              <MemberLayout><RoadmapPage /></MemberLayout>
            </ProtectedRoute>
          }
        />

        {/* Strategist routes */}
        <Route
          path="/strategist"
          element={
            <ProtectedRoute roles={['strategist', 'admin']}>
              <StrategistLayout><StrategistDashboardPage /></StrategistLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/strategist/members"
          element={
            <ProtectedRoute roles={['strategist', 'admin']}>
              <StrategistLayout><StrategistMembersPage /></StrategistLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/strategist/members/:memberId"
          element={
            <ProtectedRoute roles={['strategist', 'admin']}>
              <StrategistLayout><StrategistMemberWorkspacePage /></StrategistLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/strategist/opportunities"
          element={
            <ProtectedRoute roles={['strategist', 'admin']}>
              <StrategistLayout><StrategistOpportunitiesPage /></StrategistLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/strategist/opportunity-engine"
          element={
            <ProtectedRoute roles={['strategist', 'admin']}>
              <StrategistLayout><StrategistOpportunityEnginePage /></StrategistLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/strategist/applications"
          element={
            <ProtectedRoute roles={['strategist', 'admin']}>
              <StrategistLayout><StrategistApplicationsPage /></StrategistLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/strategist/friday-reports"
          element={
            <ProtectedRoute roles={['strategist', 'admin']}>
              <StrategistFridayReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/report-review"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminReportReviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/strategist/blog-posts"
          element={
            <ProtectedRoute roles={['strategist', 'admin']}>
              <BlogManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/strategist/blog-posts/:postId"
          element={
            <ProtectedRoute roles={['strategist', 'admin']}>
              <BlogPostEditorPage />
            </ProtectedRoute>
          }
        />

        {/* Admin routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/members"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminMembersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/members/:memberId"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminMemberDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/master-admin/feature-entitlements"
          element={
            <ProtectedRoute roles={['admin']}>
              <FeatureEntitlementsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/internal/design-system"
          element={
            <ProtectedRoute roles={['admin']}>
              <DesignSystemShowcasePage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      {isPublicRoute && <SiteFooter />}
    </>
  )
}

export default App
