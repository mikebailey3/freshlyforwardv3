export interface JobSubmissionInput {
  title: string
  company: string
  location: string
  salaryText: string
  postingUrl: string
  description: string
}

export interface JobSubmissionValidation {
  valid: boolean
  errors: Partial<Record<keyof JobSubmissionInput, string>>
}

export function validateJobSubmission(input: JobSubmissionInput): JobSubmissionValidation {
  const errors: Partial<Record<keyof JobSubmissionInput, string>> = {}

  if (!input.title.trim()) errors.title = 'Job title is required.'
  if (!input.company.trim()) errors.company = 'Company is required.'
  if (!input.description.trim()) errors.description = 'Paste at least a short description so we can score it.'

  if (input.postingUrl.trim()) {
    try {
      new URL(input.postingUrl.trim())
    } catch {
      errors.postingUrl = "That doesn't look like a valid URL."
    }
  }

  return { valid: Object.keys(errors).length === 0, errors }
}
