import { createContext, useContext } from 'react'

export const ConnectionsContext = createContext(null)

export function useConnections() {
  return useContext(ConnectionsContext)
}
