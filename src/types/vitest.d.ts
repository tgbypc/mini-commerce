/// <reference types="vitest" />
import '@testing-library/jest-dom'

import type { Mock } from 'vitest'
import type { firestore } from 'firebase-admin'

declare module 'vitest' {
  interface Assertion {
    toHaveBeenCalledWith(...expected: unknown[]): void
  }
}

declare module '@/lib/firebaseAdmin' {
  const FieldValue: {
    serverTimestamp: Mock<[] , firestore.FieldValue>
  }
}

declare module 'next/navigation' {
  type RouterMock = {
    push: Mock<[], void>
    replace: Mock<[], void>
    refresh: Mock<[], void>
    back: Mock<[], void>
  }
  export function useRouter(): RouterMock
}
