import { MemberLayout } from '@/components/MemberLayout'
import { useAuth } from '@/context/AuthContext'
import { useResumeWorkflow } from '@/hooks/useResumeWorkflow'
import { ResumeUploadPanel } from '@/components/resumeIntelligence/ResumeUploadPanel'
import { ImportReviewPanel } from '@/components/ImportReviewPanel'
import { MasterResumeBuilder } from '@/components/resumeIntelligence/MasterResumeBuilder'
import { ResumeVersionsPanel } from '@/components/resumeIntelligence/ResumeVersionsPanel'
import { ResumeAnalysisPanel } from '@/components/resumeIntelligence/ResumeAnalysisPanel'
import { AlertCircle, Loader2 } from 'lucide-react'
import type { ResumeWorkflowStage } from '@/lib/resumeIntelligence/workflow/resumeWorkflowStage'

const STAGE_MESSAGES: Record<ResumeWorkflowStage, string> = {
  no_document: 'Upload a resume to auto-fill parts of your Career Profile, or skip straight to building your Master Resume from what you already have.',
  ready_to_import: 'Scanning your upload…',
  needs_review: 'Review what we found in your resume below -- nothing changes on your Career Profile until you decide.',
  ready_for_master: 'All set -- build your Master Resume from your Career Profile below.',
  master_ready: 'Your Master Resume is ready. Run an analysis any time to see how it scores.',
  analyzed: 'Your Master Resume has been analyzed -- review the six dimensions below.',
}

/**
 * Phase 4: the routed page that finally wires together everything Phase
 * 1-3 built (ImportReviewPanel, createMasterResume, analyzeMasterResume)
 * plus this phase's additions (canonical-array writes, Master update,
 * promote-to-Master, summary override) into one real member workflow.
 * All business logic lives in `useResumeWorkflow`/`src/lib/resumeIntelligence`
 * -- this component only renders whatever state that hook exposes.
 */
export function ResumeIntelligencePage() {
  const { user, profile } = useAuth()
  const workflow = useResumeWorkflow()

  if (workflow.loading) {
    return (
      <MemberLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      </MemberLayout>
    )
  }

  if (!user || !profile) {
    return (
      <MemberLayout>
        <p className="text-sm text-ink-muted">Sign in to build your Master Resume.</p>
      </MemberLayout>
    )
  }

  const proposals = workflow.snapshot?.proposals ?? []

  return (
    <MemberLayout>
      <div className="max-w-3xl space-y-10">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-ink">Resume Intelligence</h1>
          <p className="mt-2 text-sm text-ink-muted">{STAGE_MESSAGES[workflow.stage]}</p>
        </div>

        {workflow.error && (
          <div className="flex items-start gap-2 border border-error-700 border-l-4 border-l-error-600 bg-error-950 px-4 py-3 text-sm text-error-300">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{workflow.error}</span>
          </div>
        )}

        <section>
          <h2 className="font-serif text-lg font-semibold text-ink">1. Upload a resume (optional)</h2>
          <div className="mt-3">
            <ResumeUploadPanel busy={workflow.busy} onUpload={workflow.uploadAndImportResume} />
          </div>
        </section>

        {proposals.length > 0 && (
          <section>
            <h2 className="font-serif text-lg font-semibold text-ink">2. Review what we found</h2>
            <div className="mt-3">
              <ImportReviewPanel proposals={proposals} onDecide={workflow.decideProposal} />
            </div>
          </section>
        )}

        <section>
          <h2 className="font-serif text-lg font-semibold text-ink">
            {workflow.snapshot?.hasMaster ? 'Update your Master Resume' : '3. Build your Master Resume'}
          </h2>
          <div className="mt-3">
            <MasterResumeBuilder
              isExisting={!!workflow.snapshot?.hasMaster}
              employment={profile.employment_history}
              education={profile.education}
              certifications={profile.certifications}
              skills={profile.skills}
              existingEntries={workflow.existingEntries}
              summaryOverride={null}
              busy={workflow.busy}
              onSave={workflow.saveMasterResume}
              onSaveSummaryOverride={workflow.setSummaryOverride}
            />
          </div>
        </section>

        {workflow.snapshot?.hasMaster && (
          <>
            <ResumeVersionsPanel versions={workflow.versions} busy={workflow.busy} onPromote={workflow.promoteToMaster} />

            <section>
              <h2 className="font-serif text-lg font-semibold text-ink">Analysis</h2>
              <div className="mt-3">
                <ResumeAnalysisPanel
                  analysis={workflow.analysis}
                  busy={workflow.busy}
                  onRunAnalysis={() => workflow.runAnalysis(profile.target_role)}
                />
              </div>
            </section>
          </>
        )}
      </div>
    </MemberLayout>
  )
}
