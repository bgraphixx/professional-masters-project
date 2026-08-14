import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface BannerProps {
  error?: string;
  success?: string;
}

/**
 * Renders an error or success message inline. Several handlers across the
 * app (profile update, password change, nuke-all, ML retrain) call
 * setErrorMessage/setSuccessMessage but previously had nowhere to render
 * inside the dashboard — this is that place, reused wherever a tab needs it.
 */
export default function Banner({ error, success }: BannerProps) {
  if (!error && !success) return null;
  return (
    <>
      {error && (
        <div className="mb-5 p-4 rounded-default bg-error-container/10 border border-error text-error text-sm flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="font-sans font-medium">{error}</span>
        </div>
      )}
      {success && (
        <div className="mb-5 p-4 rounded-default bg-primary-container/10 border border-primary-container text-primary text-sm flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="font-sans font-medium">{success}</span>
        </div>
      )}
    </>
  );
}
