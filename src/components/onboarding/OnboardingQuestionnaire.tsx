import { useState, useEffect, useCallback, type FormEvent } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { addTimelineEvent } from '@/lib/profile'
import { questionnaireSections, type QuestionnaireField } from '@/data/questionnaire'
import {
  ChevronLeft, ChevronRight, Check, Loader2, Plus, X, Trash2,
  User, Briefcase, GraduationCap, Wrench, Award, Target, Ban, Building2,
  DollarSign, Heart, Clock, Car, Home, MapPin, Plane, Users, TrendingUp,
  Zap, AlertTriangle, Smile, Frown, Flame, Mountain, FileCheck, Upload,
  ClipboardCheck, ShieldCheck, AlertCircle,
} from 'lucide-react'
import type { MemberProfile } from '@/types'

const iconMap: Record<string, typeof User> = {
  User, Briefcase, GraduationCap, Wrench, Award, Target, Ban, Building2,
  DollarSign, Heart, Clock, Car, Home, MapPin, Plane, Users, TrendingUp,
  Zap, AlertTriangle, Smile, Frown, Flame, Mountain, FileCheck, Upload,
  ClipboardCheck, ShieldCheck,
}

interface OnboardingStepProps {
  onNext: () => void
  onBack: () => void
  profile: MemberProfile | null
  user: { id: string; email?: string } | null
}

export function OnboardingQuestionnaire({ onNext, onBack, user }: OnboardingStepProps) {
  const [sectionIndex, setSectionIndex] = useState(0)
  const [responses, setResponses] = useState<Record<string, Record<string, unknown>>>({})
  const [saving, setSaving] = useState(false)
  const [savedIndicator, setSavedIndicator] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [completedSections, setCompletedSections] = useState<Set<string>>(new Set())

  const section = questionnaireSections[sectionIndex]
  const totalSections = questionnaireSections.length
  const progress = ((sectionIndex + 1) / totalSections) * 100

  // Load existing responses
  useEffect(() => {
    if (!user) return
    supabase
      .from('questionnaire_responses')
      .select('*')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) {
          const map: Record<string, Record<string, unknown>> = {}
          const completed = new Set<string>()
          for (const row of data) {
            map[row.section_key] = row.section_data
            if (row.is_complete) completed.add(row.section_key)
          }
          setResponses(map)
          setCompletedSections(completed)
        }
      })
  }, [user])

  // Autosave current section
  const saveSection = useCallback(
    async (sectionKey: string, data: Record<string, unknown>, isComplete: boolean) => {
      if (!user) return
      setSaving(true)
      await supabase
        .from('questionnaire_responses')
        .upsert(
          {
            user_id: user.id,
            section_key: sectionKey,
            section_data: data,
            is_complete: isComplete,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,section_key' },
        )
      setSaving(false)
      setSavedIndicator(true)
      setTimeout(() => setSavedIndicator(false), 2000)
    },
    [user],
  )

  // Debounced autosave
  useEffect(() => {
    if (!section || !responses[section.key]) return
    const timer = setTimeout(() => {
      saveSection(section.key, responses[section.key], false)
    }, 1500)
    return () => clearTimeout(timer)
  }, [responses, section, saveSection])

  const updateField = (fieldKey: string, value: unknown) => {
    setResponses((prev) => ({
      ...prev,
      [section.key]: {
        ...(prev[section.key] || {}),
        [fieldKey]: value,
      },
    }))
  }

  const validateSection = (): boolean => {
    const errs: string[] = []
    for (const field of section.fields) {
      if (field.required) {
        const value = responses[section.key]?.[field.key]
        let hasValue = false
        if (typeof value === 'boolean') hasValue = value === true
        else if (Array.isArray(value)) hasValue = value.length > 0
        else if (typeof value === 'number') hasValue = value > 0
        else hasValue = !!value && String(value).trim().length > 0

        if (!hasValue) {
          errs.push(`${field.label} is required.`)
        }
      }
    }
    setErrors(errs)
    return errs.length === 0
  }

  const handleNextSection = async () => {
    if (!validateSection()) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    await saveSection(section.key, responses[section.key] || {}, true)
    setCompletedSections((prev) => new Set(prev).add(section.key))

    if (sectionIndex < totalSections - 1) {
      setSectionIndex(sectionIndex + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      // All sections complete — sync to profile and continue
      await syncToProfile()
      if (user) {
        await addTimelineEvent(user.id, 'questionnaire_completed', 'Questionnaire Completed', 'You completed the career questionnaire.')
      }
      onNext()
    }
  }

  const handlePrevSection = () => {
    if (sectionIndex > 0) {
      setSectionIndex(sectionIndex - 1)
      setErrors([])
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      onBack()
    }
  }

  const syncToProfile = async () => {
    if (!user) return
    const allData = Object.values(responses).reduce((acc, sectionData) => ({ ...acc, ...sectionData }), {})
    const profileUpdate: Record<string, unknown> = {}
    for (const sec of questionnaireSections) {
      for (const field of sec.fields) {
        if (allData[field.key] !== undefined) {
          profileUpdate[field.key] = allData[field.key]
        }
      }
    }
    if (Object.keys(profileUpdate).length > 0) {
      await supabase.from('member_profiles').update(profileUpdate).eq('user_id', user.id)
    }
  }

  const Icon = iconMap[section.icon] || User
  const sectionData = responses[section.key] || {}

  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold text-neutral-900 sm:text-4xl">
        Career Questionnaire
      </h1>
      <p className="mt-4 text-lg text-neutral-600">
        Help us understand your career so your Strategist can build a personalized plan.
      </p>

      {/* Autosave indicator */}
      <div className="mt-4 flex items-center gap-2 text-xs">
        {saving ? (
          <span className="flex items-center gap-1.5 text-neutral-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving…
          </span>
        ) : savedIndicator ? (
          <span className="flex items-center gap-1.5 text-success-600 animate-fade-in">
            <Check className="h-3 w-3" />
            Autosaved
          </span>
        ) : (
          <span className="text-neutral-400">Changes are saved automatically</span>
        )}
      </div>

      {/* Section progress */}
      <div className="mt-6">
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span>Section {sectionIndex + 1} of {totalSections}</span>
          <span>{Math.round(progress)}% complete</span>
        </div>
        <div className="mt-1.5 h-1.5 w-full rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full bg-primary-600 transition-all duration-500"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>

      {/* Section dots */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {questionnaireSections.map((s, i) => (
          <button
            key={s.key}
            onClick={() => { setSectionIndex(i); setErrors([]); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
            className={`h-2.5 w-2.5 rounded-full transition-all ${
              i === sectionIndex
                ? 'bg-primary-600 w-6'
                : completedSections.has(s.key)
                  ? 'bg-success-500'
                  : 'bg-neutral-300'
            }`}
            aria-label={`Go to section ${i + 1}: ${s.title}`}
          />
        ))}
      </div>

      {/* Error summary */}
      {errors.length > 0 && (
        <div className="mt-6 rounded-xl border border-error-200 bg-error-50 p-4" role="alert">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-error-600" />
            <div>
              <h3 className="text-sm font-semibold text-error-600">Please fix the following:</h3>
              <ul className="mt-2 space-y-1 text-sm text-error-600">
                {errors.map((err, i) => (
                  <li key={i}>• {err}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Section content */}
      <div key={section.key} className="mt-8 animate-fade-in rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100">
            <Icon className="h-6 w-6 text-primary-600" />
          </div>
          <div>
            <h2 className="font-serif text-xl font-semibold text-neutral-900">{section.title}</h2>
            <p className="text-sm text-neutral-600">{section.description}</p>
          </div>
        </div>

        <div className="space-y-5">
          {section.fields.map((field) => (
            <FieldRenderer
              key={field.key}
              field={field}
              value={sectionData[field.key]}
              onChange={(val) => updateField(field.key, val)}
            />
          ))}

          {section.fields.length === 0 && section.key === 'review' && (
            <ReviewSection responses={responses} />
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={handlePrevSection}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100"
        >
          <ChevronLeft className="h-4 w-4" />
          {sectionIndex === 0 ? 'Back' : 'Previous'}
        </button>
        <button
          onClick={handleNextSection}
          className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700"
        >
          {sectionIndex === totalSections - 1 ? 'Complete Questionnaire' : 'Continue'}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function FieldRenderer({
  field,
  value,
  onChange,
}: {
  field: QuestionnaireField
  value: unknown
  onChange: (val: unknown) => void
}) {
  const baseInput =
    'mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm text-neutral-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500'

  switch (field.type) {
    case 'text':
      return (
        <div>
          <label htmlFor={field.key} className="block text-sm font-medium text-neutral-700">
            {field.label}
            {field.required && <span className="ml-1 text-error-500">*</span>}
          </label>
          <input
            id={field.key}
            type="text"
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className={baseInput}
            aria-required={field.required}
          />
          {field.helpText && <p className="mt-1 text-xs text-neutral-500">{field.helpText}</p>}
        </div>
      )

    case 'textarea':
      return (
        <div>
          <label htmlFor={field.key} className="block text-sm font-medium text-neutral-700">
            {field.label}
            {field.required && <span className="ml-1 text-error-500">*</span>}
          </label>
          <textarea
            id={field.key}
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            rows={4}
            className={baseInput}
            aria-required={field.required}
          />
          {field.helpText && <p className="mt-1 text-xs text-neutral-500">{field.helpText}</p>}
        </div>
      )

    case 'number':
      return (
        <div>
          <label htmlFor={field.key} className="block text-sm font-medium text-neutral-700">
            {field.label}
            {field.required && <span className="ml-1 text-error-500">*</span>}
          </label>
          <input
            id={field.key}
            type="number"
            value={(value as number | string) || ''}
            onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
            placeholder={field.placeholder}
            min={field.min}
            max={field.max}
            className={baseInput}
            aria-required={field.required}
          />
          {field.helpText && <p className="mt-1 text-xs text-neutral-500">{field.helpText}</p>}
        </div>
      )

    case 'select':
      return (
        <div>
          <label htmlFor={field.key} className="block text-sm font-medium text-neutral-700">
            {field.label}
            {field.required && <span className="ml-1 text-error-500">*</span>}
          </label>
          <select
            id={field.key}
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            className={baseInput}
            aria-required={field.required}
          >
            <option value="">Select an option…</option>
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      )

    case 'multiselect':
      return (
        <div>
          <label className="block text-sm font-medium text-neutral-700">
            {field.label}
            {field.required && <span className="ml-1 text-error-500">*</span>}
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {field.options?.map((opt) => {
              const selected = ((value as string[]) || []).includes(opt)
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    const current = (value as string[]) || []
                    onChange(selected ? current.filter((v) => v !== opt) : [...current, opt])
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                    selected
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                  }`}
                  aria-pressed={selected}
                >
                  {opt}
                </button>
              )
            })}
          </div>
          {field.helpText && <p className="mt-1 text-xs text-neutral-500">{field.helpText}</p>}
        </div>
      )

    case 'boolean':
      return (
        <div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={(value as boolean) || false}
              onChange={(e) => onChange(e.target.checked)}
              className="mt-1 h-5 w-5 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
              aria-required={field.required}
            />
            <div>
              <span className="text-sm font-medium text-neutral-700">
                {field.label}
                {field.required && <span className="ml-1 text-error-500">*</span>}
              </span>
              {field.helpText && <p className="mt-1 text-xs text-neutral-500">{field.helpText}</p>}
            </div>
          </label>
        </div>
      )

    case 'tags':
      return <TagsInput field={field} value={(value as string[]) || []} onChange={onChange} />

    case 'employment':
      return <EmploymentInput value={(value as unknown[]) || []} onChange={onChange} />

    case 'education':
      return <EducationInput value={(value as unknown[]) || []} onChange={onChange} />

    case 'certifications':
      return <CertificationsInput value={(value as unknown[]) || []} onChange={onChange} />

    default:
      return null
  }
}

function TagsInput({
  field,
  value,
  onChange,
}: {
  field: QuestionnaireField
  value: string[]
  onChange: (val: string[]) => void
}) {
  const [input, setInput] = useState('')

  const addTag = (e: FormEvent) => {
    e.preventDefault()
    const tag = input.trim()
    if (tag && !value.includes(tag)) {
      onChange([...value, tag])
    }
    setInput('')
  }

  return (
    <div>
      <label htmlFor={field.key} className="block text-sm font-medium text-neutral-700">
        {field.label}
        {field.required && <span className="ml-1 text-error-500">*</span>}
      </label>
      <form onSubmit={addTag} className="mt-1 flex gap-2">
        <input
          id={field.key}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={field.placeholder}
          className="block w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm text-neutral-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <button
          type="submit"
          className="flex items-center gap-1 rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </form>
      {field.helpText && <p className="mt-1 text-xs text-neutral-500">{field.helpText}</p>}
      {value.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {value.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 rounded-full bg-primary-100 px-3 py-1.5 text-sm font-medium text-primary-700"
            >
              {tag}
              <button
                onClick={() => onChange(value.filter((t) => t !== tag))}
                className="ml-0.5 rounded-full p-0.5 hover:bg-primary-200"
                aria-label={`Remove ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

interface EmploymentItem {
  company: string
  title: string
  start_date: string
  end_date: string | null
  current: boolean
  description: string
}

function EmploymentInput({
  value,
  onChange,
}: {
  value: unknown[]
  onChange: (val: unknown[]) => void
}) {
  const items = value as EmploymentItem[]

  const add = () => {
    onChange([
      ...items,
      { company: '', title: '', start_date: '', end_date: null, current: false, description: '' },
    ])
  }

  const update = (index: number, field: keyof EmploymentItem, val: unknown) => {
    const updated = items.map((item, i) => (i === index ? { ...item, [field]: val } : item))
    onChange(updated)
  }

  const remove = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
  }

  return (
    <div>
      <label className="block text-sm font-medium text-neutral-700">
        Employment History
        <span className="ml-1 text-error-500">*</span>
      </label>
      <div className="mt-2 space-y-4">
        {items.map((item, i) => (
          <div key={i} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-500">Role {i + 1}</span>
              <button
                onClick={() => remove(i)}
                className="text-neutral-400 hover:text-error-600"
                aria-label="Remove role"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                placeholder="Job Title"
                value={item.title}
                onChange={(e) => update(i, 'title', e.target.value)}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <input
                type="text"
                placeholder="Company"
                value={item.company}
                onChange={(e) => update(i, 'company', e.target.value)}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <input
                type="text"
                placeholder="Start Date (e.g., Jan 2022)"
                value={item.start_date}
                onChange={(e) => update(i, 'start_date', e.target.value)}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="End Date"
                  value={item.current ? 'Present' : item.end_date || ''}
                  disabled={item.current}
                  onChange={(e) => update(i, 'end_date', e.target.value)}
                  className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-neutral-100"
                />
              </div>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-neutral-600">
              <input
                type="checkbox"
                checked={item.current}
                onChange={(e) => update(i, 'current', e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
              />
              I currently work here
            </label>
            <textarea
              placeholder="Brief description of your role and accomplishments…"
              value={item.description}
              onChange={(e) => update(i, 'description', e.target.value)}
              rows={2}
              className="mt-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        ))}
      </div>
      <button
        onClick={add}
        className="mt-3 flex items-center gap-1.5 rounded-lg border border-dashed border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:border-primary-400 hover:text-primary-600"
      >
        <Plus className="h-4 w-4" />
        Add Role
      </button>
    </div>
  )
}

interface EducationItem {
  institution: string
  degree: string
  field: string
  graduation_year: string | null
}

function EducationInput({
  value,
  onChange,
}: {
  value: unknown[]
  onChange: (val: unknown[]) => void
}) {
  const items = value as EducationItem[]

  const add = () => {
    onChange([...items, { institution: '', degree: '', field: '', graduation_year: null }])
  }

  const update = (index: number, field: keyof EducationItem, val: unknown) => {
    onChange(items.map((item, i) => (i === index ? { ...item, [field]: val } : item)))
  }

  const remove = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
  }

  return (
    <div>
      <label className="block text-sm font-medium text-neutral-700">Education</label>
      <div className="mt-2 space-y-4">
        {items.map((item, i) => (
          <div key={i} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-500">Entry {i + 1}</span>
              <button onClick={() => remove(i)} className="text-neutral-400 hover:text-error-600" aria-label="Remove">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                placeholder="Institution"
                value={item.institution}
                onChange={(e) => update(i, 'institution', e.target.value)}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <input
                type="text"
                placeholder="Degree"
                value={item.degree}
                onChange={(e) => update(i, 'degree', e.target.value)}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <input
                type="text"
                placeholder="Field of Study"
                value={item.field}
                onChange={(e) => update(i, 'field', e.target.value)}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <input
                type="text"
                placeholder="Graduation Year"
                value={item.graduation_year || ''}
                onChange={(e) => update(i, 'graduation_year', e.target.value)}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={add}
        className="mt-3 flex items-center gap-1.5 rounded-lg border border-dashed border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:border-primary-400 hover:text-primary-600"
      >
        <Plus className="h-4 w-4" />
        Add Education
      </button>
    </div>
  )
}

interface CertificationItem {
  name: string
  issuer: string
  date: string | null
  expiry: string | null
}

function CertificationsInput({
  value,
  onChange,
}: {
  value: unknown[]
  onChange: (val: unknown[]) => void
}) {
  const items = value as CertificationItem[]

  const add = () => {
    onChange([...items, { name: '', issuer: '', date: null, expiry: null }])
  }

  const update = (index: number, field: keyof CertificationItem, val: unknown) => {
    onChange(items.map((item, i) => (i === index ? { ...item, [field]: val } : item)))
  }

  const remove = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
  }

  return (
    <div>
      <label className="block text-sm font-medium text-neutral-700">Certifications</label>
      <div className="mt-2 space-y-4">
        {items.map((item, i) => (
          <div key={i} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-500">Certification {i + 1}</span>
              <button onClick={() => remove(i)} className="text-neutral-400 hover:text-error-600" aria-label="Remove">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input
                type="text"
                placeholder="Certification Name"
                value={item.name}
                onChange={(e) => update(i, 'name', e.target.value)}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <input
                type="text"
                placeholder="Issuing Organization"
                value={item.issuer}
                onChange={(e) => update(i, 'issuer', e.target.value)}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <input
                type="text"
                placeholder="Date Obtained"
                value={item.date || ''}
                onChange={(e) => update(i, 'date', e.target.value)}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <input
                type="text"
                placeholder="Expiration Date (if applicable)"
                value={item.expiry || ''}
                onChange={(e) => update(i, 'expiry', e.target.value)}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={add}
        className="mt-3 flex items-center gap-1.5 rounded-lg border border-dashed border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:border-primary-400 hover:text-primary-600"
      >
        <Plus className="h-4 w-4" />
        Add Certification
      </button>
    </div>
  )
}

function ReviewSection({ responses }: { responses: Record<string, Record<string, unknown>> }) {
  const allData = Object.values(responses).reduce((acc, d) => ({ ...acc, ...d }), {})
  const filledFields = Object.entries(allData).filter(([, v]) => {
    if (Array.isArray(v)) return v.length > 0
    if (typeof v === 'boolean') return v
    return !!v
  })

  return (
    <div>
      <h3 className="font-serif text-lg font-semibold text-neutral-900">Review Your Responses</h3>
      <p className="mt-2 text-sm text-neutral-600">
        You have filled in {filledFields.length} fields. Please review your responses before submitting.
        You can go back to any section using the dots above.
      </p>

      <div className="mt-6 space-y-3">
        {questionnaireSections.slice(0, -1).map((sec) => {
          const data = responses[sec.key]
          const hasData = data && Object.values(data).some((v) => {
            if (Array.isArray(v)) return v.length > 0
            if (typeof v === 'boolean') return v
            return !!v
          })
          return (
            <div
              key={sec.key}
              className={`flex items-center justify-between rounded-lg border p-3 ${
                hasData ? 'border-success-200 bg-success-50' : 'border-neutral-200 bg-neutral-50'
              }`}
            >
              <span className="text-sm font-medium text-neutral-700">{sec.title}</span>
              {hasData ? (
                <Check className="h-4 w-4 text-success-600" />
              ) : (
                <span className="text-xs text-neutral-400">Not started</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
