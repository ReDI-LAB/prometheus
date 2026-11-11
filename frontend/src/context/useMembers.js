import { createContext, useContext } from 'react';

export const MemberContext = createContext(null);

/**
 * Custom hook to consume member data across components.
 */
export function useMembers() {
  const context = useContext(MemberContext);
  if (!context) {
    throw new Error('useMembers must be used within a MemberProvider');
  }
  return context;
}