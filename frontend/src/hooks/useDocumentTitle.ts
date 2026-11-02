import { useEffect } from 'react'

// Names the page in the browser tab while the component is shown; the previous title comes back on leave
export const useDocumentTitle = (title: string | null) => {
  useEffect(() => {
    const initialTitle = document.title
    return () => {
      document.title = initialTitle
    }
  }, [])

  useEffect(() => {
    if (title) {
      document.title = title
    }
  }, [title])
}
