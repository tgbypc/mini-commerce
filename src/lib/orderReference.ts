export function getOrderReferenceSegment(
  rawId: string | null | undefined
): string | null {
  if (!rawId) return null
  const trimmed = rawId.trim()
  if (!trimmed.length) return null
  const sanitized = trimmed.replace(/[^0-9A-Za-z]/g, '')
  const source = sanitized.length > 0 ? sanitized : trimmed
  const segment = source.slice(-6).toUpperCase()
  return segment.length ? segment : null
}

export function formatOrderReference(
  rawId: string | null | undefined
): string | null {
  const segment = getOrderReferenceSegment(rawId)
  return segment ? `#${segment}` : null
}

