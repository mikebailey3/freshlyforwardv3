// src/data/forwardReadinessQuestions.ts
import type { ReadinessQuestion } from '@/types/careerCompass'

export const forwardReadinessQuestions: ReadinessQuestion[] = [
  {
    id: 'rf_career_direction',
    text: 'Which best describes your current career direction?',
    dimension: 'careerDirection',
    options: [
      { label: 'I know exactly what role I want.', value: 100 },
      { label: 'I have a general direction.', value: 66 },
      { label: "I'm considering several paths.", value: 33 },
      { label: "I'm not sure what I should pursue.", value: 0 },
    ],
  },
  {
    id: 'rf_resume_quality',
    text: 'How well does your resume represent what you have accomplished?',
    dimension: 'resumePositioning',
    options: [
      { label: 'Very well', value: 100 },
      { label: 'Pretty well', value: 75 },
      { label: "I'm not sure", value: 50 },
      { label: 'It needs work', value: 25 },
      { label: 'I need significant help', value: 0 },
    ],
  },
  {
    id: 'rf_search_strategy',
    text: 'How confident are you in where and how to search for your next role?',
    dimension: 'searchStrategy',
    options: [
      { label: 'Very confident, I have a clear strategy', value: 100 },
      { label: 'Somewhat confident', value: 66 },
      { label: "I'm mostly guessing", value: 33 },
      { label: "I don't know where to start", value: 0 },
    ],
  },
  {
    id: 'rf_application_results',
    text: 'Which best describes your recent applications?',
    dimension: 'applicationResults',
    options: [
      { label: "I'm getting a good response.", value: 100 },
      { label: "I'm getting interviews but not offers.", value: 60 },
      { label: "I haven't started applying yet.", value: 50 },
      { label: "I'm applying but getting few responses.", value: 25 },
      { label: "I don't know which opportunities to pursue.", value: 10 },
    ],
  },
  {
    id: 'rf_interview_confidence',
    text: 'How confident do you feel going into interviews?',
    dimension: 'interviewConfidence',
    options: [
      { label: 'Very confident', value: 100 },
      { label: 'Fairly confident', value: 70 },
      { label: 'A little nervous', value: 40 },
      { label: 'Not confident at all', value: 10 },
    ],
  },
  {
    id: 'rf_resume_recency',
    text: "When's the last time you updated your resume for the roles you're targeting now?",
    dimension: 'resumePositioning',
    options: [
      { label: "Recently, and it's tailored to what I'm targeting.", value: 100 },
      { label: "It's a bit outdated but still usable.", value: 50 },
      { label: "I honestly don't remember.", value: 20 },
      { label: "I don't have a resume I'm confident in yet.", value: 0 },
    ],
  },
  {
    id: 'rf_support_need',
    text: 'How much hands-on help would you ideally like with your search?',
    dimension: 'supportNeed',
    options: [
      { label: "Give me the tools and I'll handle it.", value: 0 },
      { label: "Give me recommendations and I'll do the work.", value: 33 },
      { label: 'Work alongside me.', value: 66 },
      { label: "I'd like someone actively managing my search for me.", value: 100 },
    ],
  },
  {
    id: 'rf_urgency',
    text: 'How quickly are you hoping to make a move?',
    dimension: 'urgency',
    options: [
      { label: 'Immediately, I need something now.', value: 100 },
      { label: 'Within the next 1-3 months.', value: 66 },
      { label: 'In the next 6 months or so.', value: 33 },
      { label: 'No rush, just exploring.', value: 0 },
    ],
  },
  {
    id: 'rf_transition_type',
    text: 'Which best describes your situation?',
    dimension: 'transitionType',
    options: [
      { label: 'Entering the workforce for the first time', value: 0, transitionValue: 'first_job' },
      { label: 'Changing industries', value: 0, transitionValue: 'industry_change' },
      { label: 'Changing careers entirely', value: 0, transitionValue: 'career_change' },
      { label: 'Seeking advancement in my current field', value: 0, transitionValue: 'advancement' },
      { label: 'Returning to work after time away', value: 0, transitionValue: 'returning' },
    ],
  },
]
