/**
 * KetcherEditor — EPAM Ketcher chemical structure / reaction editor wrapper.
 *
 * Edit mode  : full interactive Ketcher editor (draw atoms, bonds, reactions).
 * Read-only  : Ketcher still loads the molecule so it is visible; because the
 *              parent hides the Save button in read-only status, nothing is
 *              ever committed back to the server.
 *
 * Usage:
 *   const ketcherRef = useRef<KetcherEditorHandle>(null)
 *   <KetcherEditor ref={ketcherRef} initialMol={exp.scheme_mol} readOnly={!editable} />
 *   // on parent Save:
 *   const mol = await ketcherRef.current?.getMol()
 */
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react'
import { Editor } from 'ketcher-react'
import { StandaloneStructServiceProvider } from 'ketcher-standalone'
import type { Ketcher } from 'ketcher-core'
import 'ketcher-react/dist/index.css'
import './styles.css'

// Single provider instance shared for the whole session
const structServiceProvider = new StandaloneStructServiceProvider()

export interface KetcherEditorHandle {
  getMol: () => Promise<string>
  loadMol: (mol: string) => Promise<void>
  getSmiles: () => Promise<string>
  recognizeImage: (file: File) => Promise<void>
}

interface KetcherEditorProps {
  initialMol?: string | null
  readOnly?: boolean
}

const KetcherEditor = forwardRef<KetcherEditorHandle, KetcherEditorProps>(
  ({ initialMol, readOnly = false }, ref) => {
    const ketcherRef    = useRef<Ketcher | null>(null)
    const lastLoadedMol = useRef<string | null | undefined>(undefined)

    // Expose getMol() / loadMol() / getSmiles() / recognizeImage() to parent via ref
    useImperativeHandle(ref, () => ({
      getMol: async () => {
        if (!ketcherRef.current) return ''
        try {
          return await ketcherRef.current.getMolfile()
        } catch {
          return ''
        }
      },
      loadMol: async (mol: string) => {
        if (!ketcherRef.current || !mol) return
        try {
          lastLoadedMol.current = mol
          await ketcherRef.current.setMolecule(mol)
        } catch (e) {
          console.warn('Ketcher loadMol failed:', e)
        }
      },
      getSmiles: async () => {
        if (!ketcherRef.current) return ''
        try {
          return await ketcherRef.current.getSmiles()
        } catch {
          return ''
        }
      },
      recognizeImage: async (file: File) => {
        if (!ketcherRef.current) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const k = ketcherRef.current as any
        if (typeof k.recognize !== 'function') {
          throw new Error('Image recognition requires a remote structure service. Not available in standalone mode.')
        }
        const result = await k.recognize(file)
        const molStr: string =
          typeof result === 'string'
            ? result
            : result?.structStr ?? result?.molfile ?? ''
        if (molStr) {
          lastLoadedMol.current = molStr
          await ketcherRef.current.setMolecule(molStr)
        }
      },
    }))

    // Load molecule whenever initialMol changes (handles late API responses
    // and Ketcher initialising inside a hidden tab before data arrived)
    useEffect(() => {
      if (ketcherRef.current && initialMol && initialMol !== lastLoadedMol.current) {
        lastLoadedMol.current = initialMol
        ketcherRef.current.setMolecule(initialMol).catch(console.warn)
      }
    }, [initialMol])

    const handleInit = async (ketcher: Ketcher) => {
      ketcherRef.current = ketcher
      if (initialMol) {
        lastLoadedMol.current = initialMol
        try {
          await ketcher.setMolecule(initialMol)
        } catch (e) {
          console.warn('Ketcher setMolecule failed:', e)
        }
      }
    }

    return (
      <div className={`chemia-ketcher-wrap${readOnly ? ' chemia-ketcher-readonly' : ''}`}>
        {readOnly && (
          <div className="chemia-ketcher-ro-banner">
            View only — experiment must be in Draft or Rejected state to edit the structure
          </div>
        )}
        <div className="chemia-ketcher-canvas">
          <Editor
            staticResourcesUrl=""
            structServiceProvider={structServiceProvider}
            onInit={handleInit}
            errorHandler={(msg) => console.error('Ketcher error:', msg)}
          />
        </div>
      </div>
    )
  },
)

KetcherEditor.displayName = 'KetcherEditor'
export default KetcherEditor
