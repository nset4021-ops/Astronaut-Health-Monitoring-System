import FullBodyDiagnostic from './FullBodyDiagnostic'

/**
 * Compatibility entry point for integrations that use the synced-avatar name.
 * The diagnostic remains local-first and shares the canonical MoveNet pipeline.
 */
export default function SyncedAvatarDiagnostic(props) {
  return <FullBodyDiagnostic {...props} />
}

