import { useState, useEffect } from 'react';
import { fetchMembers } from '../services/api';
import { MemberContext } from './useMembers';

/**
 * MemberProvider Component
 * Supplies cached member records to the component tree.
 */
export function MemberProvider({ children }) {
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialMembers() {
      try {
        const data = await fetchMembers();
        if (isMounted) {
          const list = Array.isArray(data) ? data : data.items || [];
          setMembers(list);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Mitglieder konnten nicht geladen werden.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadInitialMembers();

    return () => {
      isMounted = false;
    };
  }, []);

  function addMember(newMember) {
    setMembers((prev) => [newMember, ...prev]);
  }

  return (
    <MemberContext.Provider
      value={{
        members,
        isLoading,
        error,
        addMember,
      }}
    >
      {children}
    </MemberContext.Provider>
  );
}

export default MemberProvider;