import { describe, it, expect } from 'vitest'
import { DeterministicCareerWinInterpreter } from './deterministicInterpreter'

const interpreter = new DeterministicCareerWinInterpreter()

describe('DeterministicCareerWinInterpreter -- anti-fabrication', () => {
  it('never invents a metric for a statement with no numbers', async () => {
    const result = await interpreter.interpret('I improved inventory.')
    expect(result.metricType).toBeNull()
    expect(result.metricValue).toBeNull()
    expect(result.metricRaw).toBeNull()
  })

  it('never invents a dollar figure, percentage, team size, or timeframe for a bare statement', async () => {
    const result = await interpreter.interpret('I improved inventory.')
    expect(result.metricType).not.toBe('currency')
    expect(result.metricType).not.toBe('percentage')
    expect(result.metricType).not.toBe('count')
    expect(result.metricValue).toBeNull()
  })

  it('extracts a currency metric literally present in the statement', async () => {
    const result = await interpreter.interpret('I reduced inventory loss by $31,000.')
    expect(result.metricType).toBe('currency')
    expect(result.metricValue).toBe(31000)
    expect(result.metricRaw).toBe('$31,000')
  })

  it('extracts a percentage metric literally present in the statement', async () => {
    const result = await interpreter.interpret('I increased customer satisfaction by 15%.')
    expect(result.metricType).toBe('percentage')
    expect(result.metricValue).toBe(15)
    expect(result.metricRaw).toBe('15%')
  })

  it('does not report a percentage when only a dollar amount is present', async () => {
    const result = await interpreter.interpret('I saved the store $500 this month.')
    expect(result.metricType).toBe('currency')
    expect(result.metricType).not.toBe('percentage')
  })

  it('correctly scales a billion-dollar figure instead of silently truncating it (fix round 1)', async () => {
    const result = await interpreter.interpret('We grew revenue by $2 billion last year.')
    expect(result.metricType).toBe('currency')
    expect(result.metricValue).toBe(2_000_000_000)
  })

  it('every non-null metricValue has a metricRaw that is a literal substring of the statement', async () => {
    const statements = [
      'I reduced inventory loss by $31,000.',
      'I increased customer satisfaction by 15%.',
      'I improved inventory.',
      'Developed three associates who were later promoted into leadership.',
    ]
    for (const statement of statements) {
      const result = await interpreter.interpret(statement)
      if (result.metricValue !== null) {
        expect(result.metricRaw).not.toBeNull()
        expect(statement).toContain(result.metricRaw as string)
      }
    }
  })

  it('infers a category from keywords without requiring a numeric metric', async () => {
    const result = await interpreter.interpret('I improved inventory.')
    expect(result.category).toBe('Operational Execution')
  })

  it('returns a Promise (interface contract for future async implementations)', () => {
    const returned = interpreter.interpret('I improved inventory.')
    expect(returned).toBeInstanceOf(Promise)
  })
})
