export interface ScrapedJobInput {
  source: string
  external_id: string
  title: string
  company: string
  location: string | null
  description: string
  salary_text: string | null
  employment_type: string | null
  posting_url: string
  posted_at: string | null
  search_query: string
}
