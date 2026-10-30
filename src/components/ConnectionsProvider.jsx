import { useState } from 'react'
import { ConnectionsContext } from './connectionsContext.js'


export function ConnectionsProvider({ children }) {
  const [revision, setRevision] = useState(0)
  // A confirmed change tells visible buttons, counts, and lists to reload.
  return <ConnectionsContext.Provider value={{ revision, refreshConnections: () => setRevision((value) => value + 1) }}>{children}</ConnectionsContext.Provider>
}
